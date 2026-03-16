import type { Cache } from 'cache-manager'
import { DrizzleService } from '@db/core/drizzle.service'
import { AesService, RsaService } from '@libs/platform/modules'
import { isMasked, maskString } from '@libs/platform/utils'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { desc } from 'drizzle-orm'
import { ConfigReader } from './config-reader'
import { SystemConfigDto } from './dto/config.dto'
import {
  CACHE_KEY,
  CACHE_TTL,
  CONFIG_SECURITY_META,
  DEFAULT_CONFIG,
} from './system-config.constant'

/**
 * 系统配置管理服务（管理端专用）
 *
 * 职责：
 * - 配置的 CRUD 操作（后台管理）
 * - 敏感字段的加解密处理
 * - 配置更新后通知 ConfigReader 刷新缓存
 *
 * 注意：其他模块读取配置请使用 ConfigReader，不要注入此服务。
 */
@Injectable()
export class SystemConfigService implements OnModuleInit {
  constructor(
    /** AES 加密服务，用于敏感字段加密存储 */
    private readonly aesService: AesService,
    /** RSA 加密服务，用于解密前端传输的加密数据 */
    private readonly rsaService: RsaService,
    /** 缓存管理器 */
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    /** 配置读取器，更新后通知刷新 */
    private readonly configReader: ConfigReader,
    /** Drizzle 数据库服务 */
    private readonly drizzle: DrizzleService,
  ) {}

  /** 模块初始化时加载配置到缓存 */
  async onModuleInit() {
    await this.initCache()
  }

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 系统配置表 */
  private get systemConfig() {
    return this.drizzle.schema.systemConfig
  }

  /**
   * 获取系统配置（内部使用，解密为明文）
   * @returns 包含明文敏感信息的配置对象
   */
  async findActiveConfig() {
    return this.configReader.get()
  }

  /**
   * 获取脱敏后的系统配置（供前端展示）
   * 敏感字段会被替换为掩码（如 ****）
   * @returns 脱敏后的配置对象
   */
  async findMaskedConfig() {
    const config = this.configReader.get()
    // 深拷贝避免污染原对象
    const maskedConfig = JSON.parse(JSON.stringify(config))
    // 遍历敏感字段元数据进行脱敏
    for (const [key, metadata] of Object.entries(CONFIG_SECURITY_META)) {
      const configItem = maskedConfig[key]
      if (configItem) {
        for (const field of metadata.sensitiveFields) {
          if (configItem[field]) {
            configItem[field] = maskString(configItem[field])
          }
        }
      }
    }
    return maskedConfig
  }

  /**
   * 更新系统配置（自动处理加密和掩码忽略）
   *
   * 处理逻辑：
   * 1. 字段过滤：只更新 DEFAULT_CONFIG 中定义的字段
   * 2. 敏感字段加密：前端传输的明文或 RSA 加密数据会被 AES 加密后存储
   * 3. 掩码忽略：前端传回的掩码值（****）会被忽略，保留原值
   * 4. 缓存刷新：更新后自动刷新缓存并通知 ConfigReader
   *
   * @param dto 配置数据（结构化入参）
   * @param userId 用户 ID（预留参数）
   * @returns 是否成功
   */
  async updateConfig(dto: SystemConfigDto, userId: number) {
    const currentConfig = this.configReader.get()
    const data: any = {}

    // 结构化入参处理
    for (const key of Object.keys(dto)) {
      // 只处理 DEFAULT_CONFIG 中定义的配置项
      if (!(key in DEFAULT_CONFIG)) {
        continue
      }

      const meta = CONFIG_SECURITY_META[key]
      if (meta) {
        data[key] = await this.processSensitiveFields(
          this.filterAllowedFields(dto[key], (DEFAULT_CONFIG as any)[key]),
          (currentConfig as any)[key],
          meta.sensitiveFields,
        )
      } else {
        data[key] = this.filterAllowedFields(
          dto[key],
          (DEFAULT_CONFIG as any)[key],
        )
      }
    }

    // 过滤 undefined 字段
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    )

    // 创建新记录（支持历史配置）
    const [result] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.systemConfig)
        .values({
          ...cleanData,
          updatedById: userId,
        })
        .returning(),
    )

    // 刷新缓存并通知 ConfigReader
    await this.refreshCache(result)
    return true
  }

  /**
   * 过滤字段，只保留允许的字段
   * @param input 输入对象
   * @param allowedFields 允许的字段模板（从 DEFAULT_CONFIG 获取）
   * @returns 过滤后的对象
   */
  private filterAllowedFields(
    input: any,
    allowedFields: any,
  ): Record<string, any> {
    if (!input || typeof input !== 'object') {
      return input
    }

    const result: Record<string, any> = {}
    for (const key of Object.keys(allowedFields)) {
      if (key in input) {
        // 递归处理嵌套对象
        if (
          typeof allowedFields[key] === 'object' &&
          allowedFields[key] !== null &&
          !Array.isArray(allowedFields[key])
        ) {
          result[key] = this.filterAllowedFields(input[key], allowedFields[key])
        } else {
          result[key] = input[key]
        }
      }
    }
    return result
  }

  /**
   * 处理敏感字段（掩码回填 + 加密）
   */
  private async processSensitiveFields(
    input: Record<string, any>,
    current: Record<string, any> | null,
    sensitiveFields: string[],
  ): Promise<Record<string, any>> {
    for (const field of sensitiveFields) {
      const inputValue = input[field]

      if (inputValue && isMasked(inputValue)) {
        // 前端传回掩码则保留旧值
        input[field] = current?.[field] || ''
      } else if (inputValue) {
        // 尝试 RSA 解密，失败则视为明文
        try {
          const decryptedValue = this.rsaService.decryptWith(inputValue)
          input[field] = await this.aesService.encrypt(decryptedValue)
        } catch {
          input[field] = await this.aesService.encrypt(inputValue)
        }
      }
    }
    return input
  }

  /**
   * 刷新缓存并通知 ConfigReader
   */
  private async refreshCache(config: any) {
    const decryptedConfig = JSON.parse(JSON.stringify(config))
    await this.decryptSensitiveFields(decryptedConfig)
    await this.cacheManager.set(
      CACHE_KEY.CONFIG,
      decryptedConfig,
      this.getRandomTTL(CACHE_TTL.LONG),
    )
    await this.configReader.refresh()
  }

  /**
   * 初始化时加载配置到缓存
   * 读取最新一条配置记录
   */
  private async initCache() {
    const config = await this.findLatestConfig()
    if (config) {
      await this.refreshCache(config)
    } else {
      const [newConfig] = await this.db
        .insert(this.systemConfig)
        .values(DEFAULT_CONFIG)
        .returning()
      await this.refreshCache(newConfig)
    }
  }

  /**
   * 获取最新的配置记录
   */
  private async findLatestConfig() {
    const configs = await this.db
      .select()
      .from(this.systemConfig)
      .orderBy(desc(this.systemConfig.createdAt))
      .limit(1)

    return configs[0] ?? null
  }

  /**
   * 获取配置历史列表（分页）
   * @param page 页码
   * @param pageSize 每页数量
   */
  async findConfigHistory(page = 1, pageSize = 10) {
    const offset = (page - 1) * pageSize

    // 查询列表
    const list = await this.db
      .select()
      .from(this.systemConfig)
      .orderBy(desc(this.systemConfig.createdAt))
      .limit(pageSize)
      .offset(offset)

    // 查询总数
    const countResult = await this.db
      .select({ count: this.systemConfig.id })
      .from(this.systemConfig)

    const total = countResult.length

    return { list, total, page, pageSize }
  }

  /**
   * 解密配置中的敏感字段
   */
  private async decryptSensitiveFields(config: Record<string, any>) {
    for (const [key, metadata] of Object.entries(CONFIG_SECURITY_META)) {
      const configItem = config[key]
      if (configItem) {
        for (const field of metadata.sensitiveFields) {
          if (configItem[field]) {
            try {
              configItem[field] = await this.aesService.decrypt(
                configItem[field],
              )
            } catch {
              // 解密失败则保留原值
            }
          }
        }
      }
    }
  }

  /**
   * 生成带随机偏移的 TTL（防止缓存雪崩）
   */
  private getRandomTTL(baseTTL: number) {
    const offset = Math.floor(baseTTL * 0.1)
    return baseTTL + Math.floor(Math.random() * (2 * offset + 1)) - offset
  }
}
