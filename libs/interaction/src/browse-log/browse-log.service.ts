import type { Db } from '@db/core'
import type { IBrowseLogTargetResolver } from './interfaces/browse-log-target-resolver.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { BrowseLogGrowthService } from './browse-log-growth.service'
import { BrowseLogInteractionService } from './browse-log-interaction.service'
import { BrowseLogPermissionService } from './browse-log-permission.service'
import { BrowseLogTargetTypeEnum } from './browse-log.constant'

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

  // 注册目标解析器
  registerResolver(resolver: IBrowseLogTargetResolver) {
    if (this.resolvers.has(resolver.targetType)) {
      console.warn(
        `BrowseLog resolver for type ${resolver.targetType} is being overwritten.`,
      )
    }
    this.resolvers.set(resolver.targetType, resolver)
  }

  // 获取指定目标类型的解析器
  getResolver(targetType: BrowseLogTargetTypeEnum): IBrowseLogTargetResolver {
    const resolver = this.resolvers.get(targetType)
    if (!resolver) {
      throw new BusinessException(
      BusinessErrorCode.INVALID_OPERATION_TARGET,
      '不支持的浏览目标类型',
    )
    }
    return resolver
  }

  // 应用浏览数量变更到目标对象
  private async applyTargetCountDelta(
    tx: Db,
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    delta: number,
  ) {
    const resolver = this.getResolver(targetType)
    await resolver.applyCountDelta(tx, targetId, delta)
  }

  // 记录浏览日志后处理失败时的降级日志记录，不影响主读取流程。
  private logPostProcessFailure(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
    deferPostProcess: boolean,
    error: Error | string | null | undefined,
  ) {
    this.logger.warn(
      `browse_log_post_process_failed targetType=${targetType} targetId=${targetId} userId=${userId} deferPostProcess=${deferPostProcess} error=${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  // 记录浏览日志
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
        this.logPostProcessFailure(
          targetType,
          targetId,
          userId,
          true,
          error instanceof Error ? error : String(error),
        )
      })
      return
    }
    try {
      await runPostProcess()
    } catch (error) {
      this.logPostProcessFailure(
        targetType,
        targetId,
        userId,
        false,
        error instanceof Error ? error : String(error),
      )
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
