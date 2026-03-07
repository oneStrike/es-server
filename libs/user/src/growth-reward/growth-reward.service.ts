import { BaseService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { UserLevelRuleService } from '../level-rule/level-rule.service'

interface RewardByRuleParams {
  userId: number
  ruleType: GrowthRuleTypeEnum
  bizKey: string
  source: string
  remark?: string
  targetType?: number
  targetId?: number
}

interface RewardTaskCompleteParams {
  userId: number
  taskId: number
  assignmentId: number
  rewardConfig?: unknown
}

/**
 * Unified growth reward orchestrator.
 * Keeps business flows stable by swallowing reward failures.
 */
@Injectable()
export class UserGrowthRewardService extends BaseService {
  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly levelRuleService: UserLevelRuleService,
  ) {
    super()
  }

  /**
   * Try rewarding both points and experience by the same rule type.
   */
  async tryRewardByRule(params: RewardByRuleParams): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.growthLedgerService.applyByRule(tx, {
          userId: params.userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: params.ruleType,
          bizKey: `${params.bizKey}:POINTS`,
          source: params.source,
          remark: params.remark,
          targetType: params.targetType,
          targetId: params.targetId,
        })

        const expResult = await this.growthLedgerService.applyByRule(tx, {
          userId: params.userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: params.ruleType,
          bizKey: `${params.bizKey}:EXPERIENCE`,
          source: params.source,
          remark: params.remark,
          targetType: params.targetType,
          targetId: params.targetId,
        })

        await this.tryRefreshLevel(
          tx,
          params.userId,
          expResult.afterValue,
        )
      })
    } catch {
      // Do not break the main business flow.
    }
  }

  /**
   * Try rewarding task completion by explicit reward config.
   */
  async tryRewardTaskComplete(params: RewardTaskCompleteParams): Promise<void> {
    const reward = this.parseRewardConfig(params.rewardConfig)
    if (reward.points <= 0 && reward.experience <= 0) {
      return
    }

    const baseBizKey = [
      'task',
      'complete',
      params.taskId,
      'assignment',
      params.assignmentId,
      'user',
      params.userId,
    ].join(':')

    const context = {
      taskId: params.taskId,
      assignmentId: params.assignmentId,
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (reward.points > 0) {
          await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: GrowthAssetTypeEnum.POINTS,
            action: GrowthLedgerActionEnum.GRANT,
            amount: reward.points,
            bizKey: `${baseBizKey}:POINTS`,
            source: 'task_reward',
            remark: 'task completion reward (points)',
            targetId: params.taskId,
            context,
          })
        }

        if (reward.experience > 0) {
          const expResult = await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: GrowthAssetTypeEnum.EXPERIENCE,
            action: GrowthLedgerActionEnum.GRANT,
            amount: reward.experience,
            bizKey: `${baseBizKey}:EXPERIENCE`,
            source: 'task_reward',
            remark: 'task completion reward (experience)',
            targetId: params.taskId,
            context,
          })

          await this.tryRefreshLevel(
            tx,
            params.userId,
            expResult.afterValue,
          )
        }
      })
    } catch {
      // Do not break the main business flow.
    }
  }

  private async tryRefreshLevel(
    tx: any,
    userId: number,
    experience?: number,
  ): Promise<void> {
    if (experience === undefined) {
      return
    }

    const levelRule =
      await this.levelRuleService.getHighestLevelRuleByExperience(
        experience,
        tx,
      )

    if (!levelRule) {
      return
    }

    await tx.appUser.update({
      where: { id: userId },
      data: { levelId: levelRule.id },
    })
  }

  private parseRewardConfig(input: unknown): {
    points: number
    experience: number
  } {
    const record = this.asRecord(input)
    if (!record) {
      return { points: 0, experience: 0 }
    }

    return {
      points: this.readPositiveInt(record.points),
      experience: this.readPositiveInt(record.experience),
    }
  }

  private asRecord(input: unknown): Record<string, unknown> | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private readPositiveInt(input: unknown): number {
    if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
      return Math.floor(input)
    }

    if (typeof input === 'string') {
      const parsed = Number(input)
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.floor(parsed)
      }
    }

    return 0
  }
}
