import { PlatformService } from '@libs/platform/database'
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
 * 用户成长奖励服务
 * 统一协调积分和经验的奖励发放，同时更新用户等级
 * 设计原则：奖励失败不影响主业务流程
 */
@Injectable()
export class UserGrowthRewardService extends PlatformService {
  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly levelRuleService: UserLevelRuleService,
  ) {
    super()
  }

  /**
   * 按规则类型发放奖励
   * 同时发放积分和经验，并根据经验值更新用户等级
   */
  async tryRewardByRule(params: RewardByRuleParams): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 发放积分
        await this.growthLedgerService.applyByRule(tx, {
          userId: params.userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: params.ruleType,
          bizKey: `${params.bizKey}:POINTS`,
          remark: params.remark,
          targetType: params.targetType,
          targetId: params.targetId,
        })

        // 发放经验
        const expResult = await this.growthLedgerService.applyByRule(tx, {
          userId: params.userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: params.ruleType,
          bizKey: `${params.bizKey}:EXPERIENCE`,
          remark: params.remark,
          targetType: params.targetType,
          targetId: params.targetId,
        })

        // 尝试更新用户等级
        await this.tryRefreshLevel(
          tx,
          params.userId,
          expResult.afterValue,
        )
      })
    } catch {
      // 奖励失败不影响主业务流程
    }
  }

  /**
   * 发放任务完成奖励
   * 根据任务配置直接发放积分和经验
   */
  async tryRewardTaskComplete(params: RewardTaskCompleteParams): Promise<void> {
    const reward = this.parseRewardConfig(params.rewardConfig)
    if (reward.points <= 0 && reward.experience <= 0) {
      return
    }

    // 构建业务幂等键
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
        // 发放积分
        if (reward.points > 0) {
          await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: GrowthAssetTypeEnum.POINTS,
            action: GrowthLedgerActionEnum.GRANT,
            amount: reward.points,
            bizKey: `${baseBizKey}:POINTS`,
            source: 'task_reward',
            remark: '任务完成奖励（积分）',
            targetId: params.taskId,
            context,
          })
        }

        // 发放经验
        if (reward.experience > 0) {
          const expResult = await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: GrowthAssetTypeEnum.EXPERIENCE,
            action: GrowthLedgerActionEnum.GRANT,
            amount: reward.experience,
            bizKey: `${baseBizKey}:EXPERIENCE`,
            source: 'task_reward',
            remark: '任务完成奖励（经验）',
            targetId: params.taskId,
            context,
          })

          // 尝试更新用户等级
          await this.tryRefreshLevel(
            tx,
            params.userId,
            expResult.afterValue,
          )
        }
      })
    } catch {
      // 奖励失败不影响主业务流程
    }
  }

  /** 尝试更新用户等级 */
  private async tryRefreshLevel(
    tx: any,
    userId: number,
    experience?: number,
  ): Promise<void> {
    if (experience === undefined) {
      return
    }

    // 根据经验值获取最高匹配的等级规则
    const levelRule =
      await this.levelRuleService.getHighestLevelRuleByExperience(
        experience,
        tx,
      )

    if (!levelRule) {
      return
    }

    // 更新用户等级
    await tx.appUser.update({
      where: { id: userId },
      data: { levelId: levelRule.id },
    })
  }

  /** 解析奖励配置 */
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
