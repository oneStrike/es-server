import type { Cache } from 'cache-manager'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { CACHE_KEY, DEFAULT_CONFIG } from './system-config.constant'

/** 系统配置类型（从 DEFAULT_CONFIG 推断） */
export type SystemConfig = typeof DEFAULT_CONFIG

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
   * 获取上传配置
   */
  getUploadConfig() {
    return this.config.uploadConfig
  }
}
