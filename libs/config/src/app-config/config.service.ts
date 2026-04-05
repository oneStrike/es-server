import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable } from '@nestjs/common'
import { desc, eq } from 'drizzle-orm'
import { DEFAULT_APP_CONFIG } from './config.constant'
import { UpdateAppConfigDto } from './dto/config.dto'

/**
 * 应用配置服务
 * 负责读取当前生效的应用配置，并维护唯一一条可编辑配置记录
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
   * 获取当前生效配置。
   * 若数据库中尚未存在配置记录，会先落一条默认配置并返回，避免上层处理“未初始化”分支。
   */
  async findActiveConfig() {
    const configs = await this.db
      .select()
      .from(this.appConfig)
      .orderBy(desc(this.appConfig.id))
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
   * 更新最新一条配置记录。
   * 该模块约定只维护一条可编辑配置，因此不会暴露按 id 更新的入口；若记录缺失，直接视为初始化异常。
   */
  async updateConfig(updateConfigDto: UpdateAppConfigDto) {
    const configs = await this.db
      .select()
      .from(this.appConfig)
      .orderBy(desc(this.appConfig.id))
      .limit(1)

    const existingConfig = configs[0]

    if (!existingConfig) {
      throw new BadRequestException('应用配置不存在')
    }

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.appConfig)
        .set(updateConfigDto)
        .where(eq(this.appConfig.id, existingConfig.id)),
    )

    return true
  }
}
