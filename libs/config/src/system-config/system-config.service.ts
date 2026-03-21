import type { Cache } from 'cache-manager'
import type {
  ConfigAllowedTemplate,
  UpdateSystemConfigInput,
} from './system-config.type'
import { DrizzleService } from '@db/core'
import { AesService, RsaService } from '@libs/platform/modules'
import { isMasked, maskString } from '@libs/platform/utils'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { desc } from 'drizzle-orm'
import { ConfigReader } from './config-reader'
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
    const maskedConfig = JSON.parse(JSON.stringify(config))

    for (const [key, metadata] of Object.entries(CONFIG_SECURITY_META)) {
      const configItem = maskedConfig[key]
      if (configItem) {
        for (const path of metadata.sensitivePaths) {
          const value = this.getValueByPath(configItem, path)
          if (typeof value === 'string' && value) {
            this.setValueByPath(configItem, path, maskString(value))
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
  async updateConfig(dto: UpdateSystemConfigInput, userId: number) {
    const currentConfig = this.cloneConfig(this.configReader.get())
    const nextConfig = this.cloneConfig(currentConfig)

    for (const key of Object.keys(dto)) {
      if (!(key in DEFAULT_CONFIG)) {
        continue
      }

      const allowedTemplate = (DEFAULT_CONFIG as ConfigAllowedTemplate)[key] as
        | ConfigAllowedTemplate
        | undefined
      const filteredInput = this.filterAllowedFields(
        dto[key as keyof UpdateSystemConfigInput],
        allowedTemplate ?? {},
      )
      const meta = CONFIG_SECURITY_META[key]
      const currentItem = (currentConfig as Record<string, unknown>)[key] as
        | Record<string, unknown>
        | null

      const processedInput = meta
        ? await this.processSensitiveFields(
            filteredInput,
            currentItem,
            meta.sensitivePaths,
          )
        : filteredInput

      const mergedValue = this.deepMerge(
        this.cloneConfig(
          ((currentConfig as Record<string, unknown>)[key] ??
            (DEFAULT_CONFIG as Record<string, unknown>)[key]) as Record<
            string,
            unknown
          >,
        ),
        processedInput,
      )

      ;(nextConfig as Record<string, unknown>)[key] = mergedValue
    }

    const snapshot = this.buildPersistedSnapshot(nextConfig, userId)

    const [result] = await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.systemConfig)
        .values(snapshot)
        .returning(),
    )

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
    input: unknown,
    allowedFields: ConfigAllowedTemplate,
  ): Record<string, unknown> {
    if (!input || typeof input !== 'object') {
      return {}
    }

    const result: Record<string, unknown> = {}
    for (const key of Object.keys(allowedFields)) {
      if (key in input) {
        if (
          typeof allowedFields[key] === 'object' &&
          allowedFields[key] !== null &&
          !Array.isArray(allowedFields[key])
        ) {
          result[key] = this.filterAllowedFields(
            input[key],
            allowedFields[key] as ConfigAllowedTemplate,
          )
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
    input: Record<string, unknown>,
    current: Record<string, unknown> | null,
    sensitivePaths: string[],
  ): Promise<Record<string, unknown>> {
    for (const path of sensitivePaths) {
      if (!this.hasPath(input, path)) {
        continue
      }

      const inputValue = this.getValueByPath(input, path)

      if (typeof inputValue === 'string' && inputValue && isMasked(inputValue)) {
        this.setValueByPath(input, path, this.getValueByPath(current, path) || '')
      } else if (typeof inputValue === 'string' && inputValue) {
        try {
          const decryptedValue = this.rsaService.decryptWith(inputValue)
          this.setValueByPath(
            input,
            path,
            await this.aesService.encrypt(decryptedValue),
          )
        } catch {
          this.setValueByPath(
            input,
            path,
            await this.aesService.encrypt(inputValue),
          )
        }
      }
    }

    return input
  }

  /**
   * 刷新缓存并通知 ConfigReader
   */
  private async refreshCache(config: any) {
    const mergedConfig = this.mergeWithDefaults(config)
    await this.decryptSensitiveFields(mergedConfig)
    await this.cacheManager.set(
      CACHE_KEY.CONFIG,
      mergedConfig,
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
        .values(this.buildPersistedSnapshot(DEFAULT_CONFIG))
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
  async findConfigHistory(page = 0, pageSize = 10) {
    const result = await this.drizzle.ext.findPagination(this.systemConfig, {
      pageIndex: page,
      pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      list: result.list,
      total: result.total,
      page: result.pageIndex,
      pageSize: result.pageSize,
    }
  }

  /**
   * 解密配置中的敏感字段
   */
  private async decryptSensitiveFields(config: Record<string, any>) {
    for (const [key, metadata] of Object.entries(CONFIG_SECURITY_META)) {
      const configItem = config[key]
      if (configItem) {
        for (const path of metadata.sensitivePaths) {
          const value = this.getValueByPath(configItem, path)
          if (typeof value === 'string' && value) {
            try {
              this.setValueByPath(
                configItem,
                path,
                await this.aesService.decrypt(value),
              )
            } catch {
              // 解密失败则保留原值
            }
          }
        }
      }
    }
  }

  private mergeWithDefaults(config: Record<string, unknown>) {
    return this.deepMerge(
      this.cloneConfig(DEFAULT_CONFIG) as Record<string, unknown>,
      this.removeNullValues(this.cloneConfig(config)),
    )
  }

  private buildPersistedSnapshot(
    config: Record<string, unknown>,
    userId?: number,
  ) {
    return {
      aliyunConfig: config.aliyunConfig,
      siteConfig: config.siteConfig,
      maintenanceConfig: config.maintenanceConfig,
      contentReviewPolicy: config.contentReviewPolicy,
      uploadConfig: config.uploadConfig,
      updatedById: userId,
    }
  }

  private deepMerge(
    target: Record<string, any>,
    source: Record<string, any>,
  ): Record<string, any> {
    for (const [key, sourceValue] of Object.entries(source)) {
      if (
        this.isPlainObject(sourceValue) &&
        this.isPlainObject(target[key])
      ) {
        target[key] = this.deepMerge(target[key], sourceValue)
      } else if (sourceValue !== undefined) {
        target[key] = sourceValue
      }
    }

    return target
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private cloneConfig<T>(config: T): T {
    return JSON.parse(JSON.stringify(config)) as T
  }

  private removeNullValues<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.map(item => this.removeNullValues(item)) as T
    }

    if (this.isPlainObject(value)) {
      const result: Record<string, unknown> = {}

      for (const [key, item] of Object.entries(value)) {
        if (item === null) {
          continue
        }
        result[key] = this.removeNullValues(item)
      }

      return result as T
    }

    return value
  }

  private getValueByPath(target: Record<string, any> | null, path: string) {
    if (!target) {
      return undefined
    }

    return path
      .split('.')
      .reduce<any>((current, segment) => current?.[segment], target)
  }

  private setValueByPath(
    target: Record<string, any>,
    path: string,
    value: unknown,
  ) {
    const segments = path.split('.')
    let current: Record<string, any> = target

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i]
      if (!this.isPlainObject(current[segment])) {
        current[segment] = {}
      }
      current = current[segment]
    }

    const lastSegment = segments.at(-1)
    if (!lastSegment) {
      return
    }
    current[lastSegment] = value
  }

  private hasPath(target: Record<string, any>, path: string) {
    const segments = path.split('.')
    let current: any = target

    for (const segment of segments) {
      if (!this.isPlainObject(current) || !(segment in current)) {
        return false
      }
      current = current[segment]
    }

    return true
  }

  /**
   * 生成带随机偏移的 TTL（防止缓存雪崩）
   */
  private getRandomTTL(baseTTL: number) {
    const offset = Math.floor(baseTTL * 0.1)
    return baseTTL + Math.floor(Math.random() * (2 * offset + 1)) - offset
  }
}
