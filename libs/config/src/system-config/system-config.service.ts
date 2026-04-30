import type { Db } from '@db/core'
import type { StructuredValue } from '@libs/platform/utils'
import type { Cache } from 'cache-manager'
import type { ConfigAllowedTemplate } from './system-config.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AesService } from '@libs/platform/modules/crypto/aes.service'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'
import { isMasked, maskString } from '@libs/platform/utils'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common'
import { desc, sql } from 'drizzle-orm'
import { ConfigReader } from './config-reader'
import { UpdateSystemConfigDto } from './dto/config.dto'
import {
  CACHE_KEY,
  CACHE_TTL,
  CONFIG_SECURITY_META,
  DEFAULT_CONFIG,
} from './system-config.constant'

const SYSTEM_CONFIG_UPDATE_LOCK_KEY = 1_048_002
const SYSTEM_CONFIG_CONFLICT_MESSAGE = '系统配置已更新，请刷新后重试'

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
    const latestConfig = await this.findLatestConfig()
    if (!latestConfig) {
      await this.initCache()
      return this.findMaskedConfig()
    }

    const readableSnapshot = await this.buildReadableSnapshot(latestConfig)
    return this.maskSensitiveSnapshot(readableSnapshot)
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
   * 管理端只允许更新 DTO 明确定义的顶层配置节点；未知字段会在进入该方法前被 whitelist 过滤。
   */
  async updateConfig(dto: UpdateSystemConfigDto, userId: number) {
    const result = await this.drizzle.withTransaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${SYSTEM_CONFIG_UPDATE_LOCK_KEY})`,
      )

      const latestConfig = await this.findLatestConfig(tx)
      if (!latestConfig || latestConfig.id !== dto.id) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          SYSTEM_CONFIG_CONFLICT_MESSAGE,
        )
      }

      const currentConfig = this.cloneConfig(
        this.mergeWithDefaults(latestConfig),
      )
      const nextConfig = this.cloneConfig(currentConfig)

      for (const key of Object.keys(dto)) {
        if (key === 'id' || !(key in DEFAULT_CONFIG)) {
          continue
        }

        const allowedTemplate = (DEFAULT_CONFIG as ConfigAllowedTemplate)[
          key
        ] as ConfigAllowedTemplate | undefined
        const filteredInput = this.filterAllowedFields(
          dto[key as keyof UpdateSystemConfigDto],
          allowedTemplate ?? {},
        )
        const meta = CONFIG_SECURITY_META[key]
        const currentItem = (latestConfig as Record<string, unknown>)[
          key
        ] as Record<string, unknown> | null

        const processedInput = meta
          ? await this.processSensitiveFields(
              filteredInput,
              currentItem,
              meta.sensitivePaths,
            )
          : filteredInput

        const mergedValue = this.deepMerge(
          this.cloneConfig(
            (currentConfig[key] ??
              (DEFAULT_CONFIG as Record<string, unknown>)[key]) as Record<
              string,
              unknown
            >,
          ),
          processedInput,
        )

        nextConfig[key] = mergedValue
      }

      this.validateUploadConfig(nextConfig.uploadConfig)

      const snapshot = this.buildPersistedSnapshot(nextConfig, userId)

      const [insertedSnapshot] = await this.drizzle.withErrorHandling(() =>
        tx.insert(this.systemConfig).values(snapshot).returning(),
      )

      return insertedSnapshot
    })

    await this.refreshCache(result)
    return true
  }

  /**
   * 递归过滤输入对象，只保留 DEFAULT_CONFIG 白名单中存在的字段。
   * 这样即使前端绕过 DTO 传入额外节点，也不会写入持久化快照。
   */
  private filterAllowedFields<T>(
    input: T,
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
   * 前端回传掩码值时保留原密文，回传明文或 RSA 密文时统一转成 AES 密文存储。
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

      if (
        typeof inputValue === 'string' &&
        inputValue &&
        isMasked(inputValue)
      ) {
        this.setValueByPath(
          input,
          path,
          this.getValueByPath(current, path) || '',
        )
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
   * 刷新缓存并通知 ConfigReader 重新装载。
   * 缓存内始终保存合并默认值且已解密的配置快照，供业务模块同步读取。
   */
  private async refreshCache(config: Record<string, unknown>) {
    const mergedConfig = await this.buildReadableSnapshot(config)
    await this.cacheManager.set(
      CACHE_KEY.CONFIG,
      mergedConfig,
      this.getRandomTTL(CACHE_TTL.LONG),
    )
    await this.configReader.refresh()
  }

  /**
   * 模块初始化时预热缓存。
   * 若数据库中还没有配置记录，会先写入一条默认快照，保证读取侧永远能拿到完整配置。
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
   * 读取最新一条系统配置快照。
   */
  private async findLatestConfig(db: Db = this.db) {
    const configs = await db
      .select()
      .from(this.systemConfig)
      .orderBy(desc(this.systemConfig.id))
      .limit(1)

    return configs[0] ?? null
  }

  /**
   * 获取配置历史分页。
   * 历史页保留原始快照，供后台追溯每次配置变更的落库结果。
   */
  async findConfigHistory(page = 1, pageSize = 10) {
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
   * 解密快照中的敏感字段。
   * 解密失败时保留原值，避免单个字段损坏导致整份配置不可读。
   */
  private async decryptSensitiveFields(config: Record<string, unknown>) {
    for (const [key, metadata] of Object.entries(CONFIG_SECURITY_META)) {
      const configItem = config[key] as Record<string, unknown> | undefined
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

  /**
   * 把持久化快照转换成可读配置快照。
   * 该快照保留 id / createdAt / updatedAt 等元信息，供管理端作为版本基线使用。
   */
  private async buildReadableSnapshot(config: Record<string, unknown>) {
    const mergedConfig = this.mergeWithDefaults(config)
    await this.decryptSensitiveFields(mergedConfig)
    return mergedConfig
  }

  /**
   * 复制一份配置快照并对敏感字段做脱敏展示。
   * 仅管理端读取接口使用，不会回写缓存。
   */
  private maskSensitiveSnapshot<T extends Record<string, unknown>>(config: T) {
    const maskedConfig = this.cloneConfig(config)

    for (const [key, metadata] of Object.entries(CONFIG_SECURITY_META)) {
      const configItem = maskedConfig[key] as
        | Record<string, unknown>
        | undefined
      if (!configItem) {
        continue
      }

      for (const path of metadata.sensitivePaths) {
        const value = this.getValueByPath(configItem, path)
        if (typeof value === 'string' && value) {
          this.setValueByPath(configItem, path, maskString(value))
        }
      }
    }

    return maskedConfig
  }

  /**
   * 将持久化快照与默认配置合并，补齐缺失节点。
   */
  private mergeWithDefaults(config: Record<string, unknown>) {
    return this.deepMerge(
      this.cloneConfig(DEFAULT_CONFIG) as Record<string, unknown>,
      this.removeNullValues(this.cloneConfig(config)),
    )
  }

  /**
   * 组装落库快照，只持久化允许存储的顶层配置块和更新人。
   */
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

  /**
   * 递归合并对象，`undefined` 不覆盖目标值。
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    for (const [key, sourceValue] of Object.entries(source)) {
      if (this.isPlainObject(sourceValue) && this.isPlainObject(target[key])) {
        target[key] = this.deepMerge(target[key], sourceValue)
      } else if (sourceValue !== undefined) {
        target[key] = sourceValue
      }
    }

    return target
  }

  /**
   * 判断值是否为可递归处理的普通对象。
   */
  private isPlainObject<T>(
    value: T,
  ): value is Extract<T, Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  /**
   * 通过 JSON 序列化复制配置对象，避免原地修改缓存快照。
   */
  private cloneConfig<T>(config: T) {
    return JSON.parse(JSON.stringify(config)) as T
  }

  /**
   * 递归移除对象中的 `null` 值，避免数据库里的空值覆盖默认配置。
   */
  private removeNullValues<T>(value: T) {
    if (Array.isArray(value)) {
      return value.map((item) => this.removeNullValues(item)) as T
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

  /**
   * 按路径读取对象值，路径格式为 `a.b.c`。
   */
  private getValueByPath(target: Record<string, unknown> | null, path: string) {
    if (!target) {
      return undefined
    }

    let current:
      | Record<string, unknown>
      | string
      | number
      | boolean
      | null
      | undefined = target
    for (const segment of path.split('.')) {
      if (!this.isPlainObject(current)) {
        return undefined
      }
      current = current[segment] as
        | Record<string, unknown>
        | string
        | number
        | boolean
        | null
        | undefined
    }
    return current
  }

  /**
   * 按路径写入对象值，缺失的中间节点会自动补成空对象。
   */
  private setValueByPath(
    target: Record<string, unknown>,
    path: string,
    value: StructuredValue,
  ) {
    const segments = path.split('.')
    let current: Record<string, unknown> = target

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i]
      if (!this.isPlainObject(current[segment])) {
        current[segment] = {}
      }
      current = current[segment] as Record<string, unknown>
    }

    const lastSegment = segments.at(-1)
    if (!lastSegment) {
      return
    }
    current[lastSegment] = value
  }

  /**
   * 判断对象上是否存在指定路径。
   */
  private hasPath(target: Record<string, unknown>, path: string) {
    const segments = path.split('.')
    let current: Record<string, unknown> | undefined = target

    for (const segment of segments) {
      if (!this.isPlainObject(current) || !(segment in current)) {
        return false
      }
      current = current[segment] as Record<string, unknown> | undefined
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

  /**
   * 保存前校验上传配置的 provider 与子配置是否一致。
   * 本轮只做静态字段完整性校验，不做网络探测。
   */
  private validateUploadConfig<T>(uploadConfig: T) {
    if (!this.isPlainObject(uploadConfig)) {
      return
    }

    const provider = uploadConfig.provider

    if (provider === UploadProviderEnum.QINIU) {
      this.assertRequiredStringFields(
        uploadConfig.qiniu,
        ['accessKey', 'secretKey', 'bucket', 'domain'],
        '七牛上传配置不完整',
      )
      return
    }

    if (provider === UploadProviderEnum.SUPERBED) {
      this.assertRequiredStringFields(
        uploadConfig.superbed,
        ['token'],
        'Superbed 上传配置不完整',
      )
    }
  }

  /**
   * 断言对象上的必填字符串字段全部存在且非空。
   */
  private assertRequiredStringFields<T>(
    target: T,
    requiredFields: string[],
    errorPrefix: string,
  ) {
    const record = this.isPlainObject(target)
      ? target
      : ({} as Record<string, unknown>)
    const missingFields = requiredFields.filter((field) => {
      const value = record[field]
      return typeof value !== 'string' || value.trim() === ''
    })

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `${errorPrefix}：缺少 ${missingFields.join('、')}`,
      )
    }
  }
}
