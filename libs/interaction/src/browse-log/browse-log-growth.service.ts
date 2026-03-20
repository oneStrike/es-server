import { DrizzleService } from '@db/core'
import { GrowthAssetTypeEnum, GrowthLedgerService } from '@libs/growth'
import { Injectable, Logger } from '@nestjs/common'
import { resolveInteractionGrowthRuleType } from '../interaction-target-growth-rule'
import { mapBrowseLogTargetTypeToInteractionTargetType } from './browse-log-target.mapping'
import { BrowseLogTargetTypeEnum } from './browse-log.constant'

/**
 * 浏览日志成长服务
 * 处理浏览记录相关的积分和经验奖励
 */
@Injectable()
export class BrowseLogGrowthService {
  private readonly logger = new Logger(BrowseLogGrowthService.name)

  constructor(
    /** 成长账本服务 */
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  /**
   * 奖励浏览记录
   * 根据目标类型发放对应的积分和经验奖励
   *
   * @param targetType - 浏览目标类型
   * @param targetId - 目标ID
   * @param userId - 用户ID
   */
  async rewardBrowseLogRecorded(
    targetType: BrowseLogTargetTypeEnum,
    targetId: number,
    userId: number,
  ): Promise<void> {
    const interactionTargetType =
      mapBrowseLogTargetTypeToInteractionTargetType(targetType)
    const ruleType = resolveInteractionGrowthRuleType(
      'view',
      interactionTargetType,
    )
    if (!ruleType) {
      return
    }

    const baseBizKey = `view:${targetType}:${targetId}:user:${userId}`

    try {
      await this.drizzle.withTransaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType,
          bizKey: `${baseBizKey}:POINTS`,
          remark: `浏览目标 #${targetId}`,
          targetType,
          targetId,
        })

        await this.growthLedgerService.applyByRule(tx, {
          userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType,
          bizKey: `${baseBizKey}:EXPERIENCE`,
          remark: `浏览目标 #${targetId}`,
          targetType,
          targetId,
        })
      })
    } catch (error) {
      this.logger.warn(
        `reward_browse_log_failed userId=${userId} targetType=${targetType} targetId=${targetId} ruleType=${ruleType} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}
