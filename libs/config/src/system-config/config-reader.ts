import type { Cache } from 'cache-manager'
import type {
  SystemConfig,
  ThirdPartyResourceParseConfig,
} from './system-config.type'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { CACHE_KEY, DEFAULT_CONFIG } from './system-config.constant'

const THIRD_PARTY_RESOURCE_PARSE_CONFIG_BOUNDS = {
  apiIntervalMs: { min: 1, max: 60000 },
  imageIntervalMs: { min: 1, max: 60000 },
  hostCacheTtlSeconds: { min: 1, max: 3600 },
  maxQueueSize: { min: 1, max: 10000 },
} as const

/**
 * 配置读取器
 *
 * 提供全局配置读取能力，启动时加载配置到缓存，其他模块直接从缓存读取。
 *
 * 特点：
 * - 同步读取：配置已在启动时加载到内存，无需 await
 * - 类型安全：从 DEFAULT_CONFIG 自动推断类型
 * - 易于使用：提供配置级别的 getter 方法
 *
 * @example
 * ```typescript
 * constructor(private readonly configReader: ConfigReader) {}
 *
 * // 获取阿里云配置
 * const aliyunConfig = this.configReader.getAliyunConfig()
 *
 * // 检查是否维护模式
 * if (this.configReader.isMaintenanceMode()) {
 *   throw new MaintenanceException()
 * }
 * ```
 */
@Injectable()
export class ConfigReader implements OnModuleInit {
  /** 内存中的配置缓存 */
  private config: SystemConfig = DEFAULT_CONFIG

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /** 模块初始化时加载配置到内存 */
  async onModuleInit() {
    const cached = await this.cacheManager.get<SystemConfig>(CACHE_KEY.CONFIG)
    if (cached) {
      this.config = cached
    }
  }

  /**
   * 刷新配置（由 SystemConfigService 在更新配置后调用）
   */
  async refresh() {
    const cached = await this.cacheManager.get<SystemConfig>(CACHE_KEY.CONFIG)
    if (cached) {
      this.config = cached
    }
  }

  /**
   * 获取完整系统配置
   */
  get() {
    return this.config
  }

  /**
   * 获取阿里云配置
   */
  getAliyunConfig() {
    return this.config.aliyunConfig
  }

  /**
   * 获取站点配置
   */
  getSiteConfig() {
    return this.config.siteConfig
  }

  /**
   * 获取维护模式配置
   */
  getMaintenanceConfig() {
    return this.config.maintenanceConfig
  }

  /**
   * 检查是否处于维护模式
   */
  isMaintenanceMode() {
    return this.config.maintenanceConfig.enableMaintenanceMode
  }

  /**
   * 获取内容审核策略配置
   */
  getContentReviewPolicy() {
    return this.config.contentReviewPolicy
  }

  /**
   * 获取运营配置
   */
  getOperationConfig() {
    return this.config.operationConfig
  }

  /**
   * 获取 forum 话题（hashtag）配置
   */
  getForumHashtagConfig() {
    return this.config.operationConfig.forumHashtagConfig
  }

  /**
   * 获取安全配置
   */
  getSecurityConfig() {
    return this.config.securityConfig
  }

  /**
   * 获取远程图片导入安全配置
   */
  getRemoteImageImportSecurityConfig() {
    return this.config.securityConfig.remoteImageImport
  }

  // 获取三方资源解析配置，并把旧快照、非法数字或缺失字段归一化为安全值。
  getThirdPartyResourceParseConfig(): ThirdPartyResourceParseConfig {
    const defaults = DEFAULT_CONFIG.thirdPartyResourceParseConfig
    const source = this.config.thirdPartyResourceParseConfig ?? defaults

    return {
      enabled:
        typeof source.enabled === 'boolean' ? source.enabled : defaults.enabled,
      apiIntervalMs: this.normalizePositiveInteger(
        source.apiIntervalMs,
        defaults.apiIntervalMs,
        THIRD_PARTY_RESOURCE_PARSE_CONFIG_BOUNDS.apiIntervalMs,
      ),
      imageIntervalMs: this.normalizePositiveInteger(
        source.imageIntervalMs,
        defaults.imageIntervalMs,
        THIRD_PARTY_RESOURCE_PARSE_CONFIG_BOUNDS.imageIntervalMs,
      ),
      hostCacheTtlSeconds: this.normalizePositiveInteger(
        source.hostCacheTtlSeconds,
        defaults.hostCacheTtlSeconds,
        THIRD_PARTY_RESOURCE_PARSE_CONFIG_BOUNDS.hostCacheTtlSeconds,
      ),
      maxQueueSize: this.normalizePositiveInteger(
        source.maxQueueSize,
        defaults.maxQueueSize,
        THIRD_PARTY_RESOURCE_PARSE_CONFIG_BOUNDS.maxQueueSize,
      ),
    }
  }

  /**
   * 获取上传配置
   */
  getUploadConfig() {
    return this.config.uploadConfig
  }

  // 把配置中的正整数限制在声明边界内，非法值回落到默认值。
  private normalizePositiveInteger(
    value: unknown,
    defaultValue: number,
    bounds: { max: number; min: number },
  ) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return defaultValue
    }

    const integerValue = Math.floor(value)
    if (integerValue < bounds.min) {
      return defaultValue
    }
    return Math.min(integerValue, bounds.max)
  }
}
