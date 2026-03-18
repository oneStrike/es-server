import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DEFAULT_APP_CONFIG } from './config.constant'
import { UpdateAppConfigInput } from './config.type'

/**
 * 应用配置服务
 * 提供应用配置的创建、查询、更新等功能
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例 */
  private get db() {
    return this.drizzle.db
  }

  /** 应用配置表 */
  private get appConfig() {
    return this.drizzle.schema.appConfig
  }

  /**
   * 获取最新应用配置
   * @returns 最新版本的应用配置
   */
  async findActiveConfig() {
    const configs = await this.db
      .select()
      .from(this.appConfig)
      .where(eq(this.appConfig.id, 1))
      .limit(1)

    const config = configs[0]

    if (!config) {
      const [newConfig] = await this.db
        .insert(this.appConfig)
        .values(DEFAULT_APP_CONFIG)
        .returning()
      return newConfig
    }
    return config
  }

  /**
   * 更新应用配置
   * @param updateConfigDto 更新数据
   * @returns 是否成功
   */
  async updateConfig(updateConfigDto: UpdateAppConfigInput) {
    const configs = await this.db
      .select()
      .from(this.appConfig)
      .where(eq(this.appConfig.id, 1))
      .limit(1)

    const existingConfig = configs[0]

    if (!existingConfig) {
      throw new BadRequestException('应用配置不存在')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appConfig)
        .set(updateConfigDto)
        .where(eq(this.appConfig.id, 1)),
    )

    return true
  }
}
