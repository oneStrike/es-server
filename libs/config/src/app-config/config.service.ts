import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { desc, eq, sql } from 'drizzle-orm'
import { DEFAULT_APP_CONFIG } from './config.constant'
import { UpdateAppConfigDto } from './dto/config.dto'

const APP_CONFIG_INIT_LOCK_KEY = 1_048_001

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
    const config = await this.findLatestConfig()
    if (config) {
      return config
    }

    return this.ensureActiveConfig()
  }

  /**
   * 更新最新一条配置记录。
   * 该模块约定只维护一条可编辑配置，因此不会暴露按 id 更新的入口。
   * 若首次写入发生在空表状态，会先初始化默认配置，再在同一逻辑链路内更新目标字段。
   */
  async updateConfig(updateConfigDto: UpdateAppConfigDto, userId: number) {
    const existingConfig = await this.findActiveConfig()

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appConfig)
          .set({
            ...updateConfigDto,
            updatedById: userId,
          })
          .where(eq(this.appConfig.id, existingConfig.id)),
      {
        notFound: '应用配置不存在',
      },
    )

    return true
  }

  /**
   * 读取当前最新一条配置记录。
   * 所有公开读写入口都基于这条记录工作，保持“单例配置”的稳定语义。
   */
  private async findLatestConfig(db: Db = this.db) {
    const configs = await db
      .select()
      .from(this.appConfig)
      .orderBy(desc(this.appConfig.id))
      .limit(1)

    return configs[0] ?? null
  }

  /**
   * 空表初始化时使用事务级 advisory lock 收口并发竞争，避免首访并发插入多条默认配置。
   */
  private async ensureActiveConfig() {
    return this.drizzle.withTransaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${APP_CONFIG_INIT_LOCK_KEY})`)

      const existingConfig = await this.findLatestConfig(tx)
      if (existingConfig) {
        return existingConfig
      }

      const [newConfig] = await tx
        .insert(this.appConfig)
        .values(DEFAULT_APP_CONFIG)
        .returning()

      return newConfig
    })
  }
}
