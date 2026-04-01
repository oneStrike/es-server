import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { BrowseLogGrowthService } from './browse-log-growth.service'
import { BrowseLogInteractionService } from './browse-log-interaction.service'
import { BrowseLogPermissionService } from './browse-log-permission.service'
import { BrowseLogTargetTypeEnum } from './browse-log.constant'
import { IBrowseLogTargetResolver } from './interfaces/browse-log-target-resolver.interface'

@Injectable()
export class BrowseLogService {
  private readonly logger = new Logger(BrowseLogService.name)

  constructor(
    private readonly browseLogPermissionService: BrowseLogPermissionService,
    private readonly browseLogInteractionService: BrowseLogInteractionService,
    private readonly browseLogGrowthService: BrowseLogGrowthService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userBrowseLog() {
    return this.drizzle.schema.userBrowseLog
  }

  /** 目标类型到解析器的映射表 */
  private readonly resolvers = new Map<
    BrowseLogTargetTypeEnum,
    IBrowseLogTargetResolver
  >()

  /**
   * 注册目标解析器
   * @param resolver - 浏览日志目标解析器实例
   */
  registerResolver(resolver: IBrowseLogTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `BrowseLog resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  /**
   * 获取指定目标类型的解析器
   * @param targetType - 浏览目标类型
   * @returns 对应的目标解析器
   */
  getResolver(targetType: BrowseLogTargetTypeEnum): IBrowseLogTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BadRequestException('不支持的浏览目标类型')
    }
    return resolver
  }

  /**
   * 应用浏览数量变更到目标对象
   */
  private async applyTargetCountDelta(
    tx: Db,
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    delta: number,
  ) {
    const resolver = this.getResolver(targetType)
    await resolver.applyCountDelta(tx, targetId, delta)
  }

  private logPostProcessFailure(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
    deferPostProcess: boolean,
    error: unknown,
  ) {
    this.logger.warn(
      `browse_log_post_process_failed targetType=${targetType} targetId=${targetId} userId=${userId} deferPostProcess=${deferPostProcess} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  /**
   * 记录浏览日志
   *
   * @param targetType - 目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   * @param ipAddress - IP地址
   * @param device - 设备信息
   * @param userAgent - UserAgent
   * @param options - 附加选项
   * @param options.skipTargetValidation - 是否跳过目标合法性校验
   * @param options.deferPostProcess - 是否延迟执行后置处理（成长奖励等）
   */
  async recordBrowseLog(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
    options: {
      skipTargetValidation?: boolean
      deferPostProcess?: boolean
    } = {},
  ): Promise<void> {
    // 1. 校验用户权限
    await this.browseLogPermissionService.ensureCanBrowse(userId)

    const resolver = this.getResolver(targetType)

    // 2. 核心逻辑执行（事务内）
    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (tx) => {
        if (!options.skipTargetValidation) {
          await resolver.ensureTargetValid(tx, targetId)
        }

        await tx.insert(this.userBrowseLog).values({
          targetType,
          targetId,
          userId,
          ipAddress,
          device,
          userAgent,
          viewedAt: new Date(),
        })

        await this.applyTargetCountDelta(tx, targetType, targetId, 1)
      }),
    )

    const runPostProcess = async () => {
      await this.browseLogInteractionService.handleBrowseLogRecorded()
      await this.browseLogGrowthService.rewardBrowseLogRecorded(
        targetType,
        targetId,
        userId,
      )
    }

    if (options.deferPostProcess) {
      void runPostProcess().catch((error) => {
        this.logPostProcessFailure(targetType, targetId, userId, true, error)
      })
      return
    }
    try {
      await runPostProcess()
    } catch (error) {
      this.logPostProcessFailure(targetType, targetId, userId, false, error)
      throw error
    }
  }

  async recordBrowseLogSafely(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
    ipAddress?: string,
    device?: string,
    userAgent?: string,
    options: {
      skipTargetValidation?: boolean
      deferPostProcess?: boolean
    } = {},
  ): Promise<void> {
    try {
      await this.recordBrowseLog(
        targetType,
        targetId,
        userId,
        ipAddress,
        device,
        userAgent,
        options,
      )
    } catch (error) {
      this.logger.warn(
        `record_browse_log_failed targetType=${targetType} targetId=${targetId} userId=${userId} skipTargetValidation=${Boolean(
          options.skipTargetValidation,
        )} deferPostProcess=${Boolean(options.deferPostProcess)} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
