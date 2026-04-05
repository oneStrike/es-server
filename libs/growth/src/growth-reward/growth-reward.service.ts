import type { Db } from '@db/core'
import type { EventEnvelope } from '@libs/growth/event-definition'
import type { GrowthLedgerApplyResult } from '../growth-ledger/growth-ledger.internal'
import type {
  GrowthRuleRewardSettlementResult,
  TaskRewardAssetResult,
  TaskRewardSettlementResult,
} from './growth-reward.types'
import { DrizzleService } from '@db/core'
import { Injectable, Logger } from '@nestjs/common'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonLabel,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { TaskAssignmentRewardResultTypeEnum } from '../task/task.constant'
import { GrowthRewardDedupeResultEnum } from './growth-reward.types'

interface RewardByRuleParams {
  userId: number
  ruleType: GrowthRuleTypeEnum
  bizKey: string
  source: string
  remark?: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
  occurredAt?: Date
  tx?: Db
}

interface RewardTaskCompleteParams {
  userId: number
  taskId: number
  assignmentId: number
  rewardConfig?: unknown
  eventEnvelope?: EventEnvelope
}

/**
 * 用户成长奖励服务
 * 统一协调积分和经验的奖励发放，同时更新用户等级
 * 设计原则：奖励失败不影响主业务流程
 */
@Injectable()
export class UserGrowthRewardService {
  private readonly logger = new Logger(UserGrowthRewardService.name)

  constructor(
    private readonly growthLedgerService: GrowthLedgerService,
    private readonly drizzle: DrizzleService,
  ) {}

  /**
   * 按规则类型发放奖励
   * 同时发放积分和经验，并根据经验值更新用户等级
   */
  async tryRewardByRule(
    params: RewardByRuleParams,
  ): Promise<GrowthRuleRewardSettlementResult> {
    let pointsResult: GrowthLedgerApplyResult | undefined
    let experienceResult: GrowthLedgerApplyResult | undefined

    try {
      await this.runWithOptionalTransaction(params.tx, async (tx) => {
        // 发放积分
        pointsResult = await this.growthLedgerService.applyByRule(tx, {
          userId: params.userId,
          assetType: GrowthAssetTypeEnum.POINTS,
          ruleType: params.ruleType,
          bizKey: `${params.bizKey}:POINTS`,
          source: GrowthLedgerSourceEnum.GROWTH_RULE,
          remark: params.remark,
          targetType: params.targetType,
          targetId: params.targetId,
          context: this.buildRuleRewardContext(params),
          occurredAt: params.occurredAt,
        })

        // 发放经验
        experienceResult = await this.growthLedgerService.applyByRule(tx, {
          userId: params.userId,
          assetType: GrowthAssetTypeEnum.EXPERIENCE,
          ruleType: params.ruleType,
          bizKey: `${params.bizKey}:EXPERIENCE`,
          source: GrowthLedgerSourceEnum.GROWTH_RULE,
          remark: params.remark,
          targetType: params.targetType,
          targetId: params.targetId,
          context: this.buildRuleRewardContext(params),
          occurredAt: params.occurredAt,
        })
      })

      this.logSkippedRuleReward(params, 'POINTS', pointsResult)
      this.logSkippedRuleReward(params, 'EXPERIENCE', experienceResult)

      return this.buildRuleRewardSettlementResult({
        params,
        pointsResult,
        experienceResult,
      })
    } catch (error) {
      this.logger.warn(
        `reward_by_rule_failed userId=${params.userId} ruleType=${params.ruleType} bizKey=${params.bizKey} source=${params.source} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return {
        success: false,
        source: GrowthLedgerSourceEnum.GROWTH_RULE,
        bizKey: params.bizKey,
        ruleType: params.ruleType,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        ledgerRecordIds: [],
        errorMessage:
          error instanceof Error ? error.message : '基础奖励发放失败，请稍后重试',
        pointsResult,
        experienceResult,
      }
    }
  }

  /**
   * 记录未成功落账的规则奖励结果。
   * 规则缺失、禁用或命中限额时不会抛异常，需要在这里补齐可观测性。
   */
  private logSkippedRuleReward(
    params: RewardByRuleParams,
    assetType: 'POINTS' | 'EXPERIENCE',
    result?: GrowthLedgerApplyResult,
  ) {
    if (!result || result.success || result.duplicated) {
      return
    }

    this.logger.warn(
      `reward_by_rule_skipped userId=${params.userId} ruleType=${params.ruleType} bizKey=${params.bizKey} source=${params.source} assetType=${assetType} reason=${
        result.reason ?? 'unknown'
      }`,
    )
  }

  /**
   * 发放任务完成奖励
   * 根据任务配置直接发放积分和经验
   */
  async tryRewardTaskComplete(
    params: RewardTaskCompleteParams,
  ): Promise<TaskRewardSettlementResult> {
    const settledAt = new Date()
    const reward = this.parseRewardConfig(params.rewardConfig)
    const baseBizKey = [
      'task',
      'complete',
      params.taskId,
      'assignment',
      params.assignmentId,
      'user',
      params.userId,
    ].join(':')
    if (reward.points <= 0 && reward.experience <= 0) {
      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        reward,
        settledAt,
        resultType: TaskAssignmentRewardResultTypeEnum.APPLIED,
      })
    }

    const context = this.buildTaskRewardContext(params)

    try {
      let pointsResult: GrowthLedgerApplyResult | undefined
      let experienceResult: GrowthLedgerApplyResult | undefined

      await this.drizzle.withTransaction(async (tx) => {
        // 发放积分
        if (reward.points > 0) {
          pointsResult = await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: GrowthAssetTypeEnum.POINTS,
            action: GrowthLedgerActionEnum.GRANT,
            amount: reward.points,
            bizKey: `${baseBizKey}:POINTS`,
            source: GrowthLedgerSourceEnum.TASK_BONUS,
            remark: '任务完成奖励（积分）',
            targetId: params.taskId,
            context,
          })

          this.ensureTaskRewardApplySucceeded(
            '积分',
            GrowthAssetTypeEnum.POINTS,
            pointsResult,
          )
        }

        // 发放经验
        if (reward.experience > 0) {
          experienceResult = await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: GrowthAssetTypeEnum.EXPERIENCE,
            action: GrowthLedgerActionEnum.GRANT,
            amount: reward.experience,
            bizKey: `${baseBizKey}:EXPERIENCE`,
            source: GrowthLedgerSourceEnum.TASK_BONUS,
            remark: '任务完成奖励（经验）',
            targetId: params.taskId,
            context,
          })

          this.ensureTaskRewardApplySucceeded(
            '经验',
            GrowthAssetTypeEnum.EXPERIENCE,
            experienceResult,
          )
        }
      })

      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        reward,
        settledAt,
        pointsResult,
        experienceResult,
        resultType: this.resolveTaskRewardResultType([
          this.toTaskRewardAssetResult(
            GrowthAssetTypeEnum.POINTS,
            reward.points,
            pointsResult,
          ),
          this.toTaskRewardAssetResult(
            GrowthAssetTypeEnum.EXPERIENCE,
            reward.experience,
            experienceResult,
          ),
        ]),
      })
    } catch (error) {
      this.logger.warn(
        `reward_task_complete_failed userId=${params.userId} taskId=${params.taskId} assignmentId=${params.assignmentId} eventKey=${params.eventEnvelope?.key ?? 'TASK_COMPLETE'} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        reward,
        settledAt,
        resultType: TaskAssignmentRewardResultTypeEnum.FAILED,
        errorMessage:
          error instanceof Error ? error.message : '任务奖励发放失败，请稍后重试',
      })
    }
  }

  private buildTaskRewardSettlementResult(params: {
    bizKey: string
    reward: { points: number, experience: number }
    settledAt: Date
    resultType: TaskAssignmentRewardResultTypeEnum
    pointsResult?: GrowthLedgerApplyResult
    experienceResult?: GrowthLedgerApplyResult
    errorMessage?: string
  }): TaskRewardSettlementResult {
    const pointsReward = this.toTaskRewardAssetResult(
      GrowthAssetTypeEnum.POINTS,
      params.reward.points,
      params.pointsResult,
      params.resultType === TaskAssignmentRewardResultTypeEnum.FAILED,
    )
    const experienceReward = this.toTaskRewardAssetResult(
      GrowthAssetTypeEnum.EXPERIENCE,
      params.reward.experience,
      params.experienceResult,
      params.resultType === TaskAssignmentRewardResultTypeEnum.FAILED,
    )

    const ledgerRecordIds = [pointsReward.recordId, experienceReward.recordId]
      .filter((id): id is number => typeof id === 'number')

    return {
      success: params.resultType !== TaskAssignmentRewardResultTypeEnum.FAILED,
      resultType: params.resultType,
      source: GrowthLedgerSourceEnum.TASK_BONUS,
      bizKey: params.bizKey,
      dedupeResult: this.toTaskRewardDedupeResult(params.resultType),
      settledAt: params.settledAt,
      ledgerRecordIds,
      errorMessage: params.errorMessage,
      pointsReward,
      experienceReward,
    }
  }

  private buildRuleRewardSettlementResult(params: {
    params: RewardByRuleParams
    pointsResult?: GrowthLedgerApplyResult
    experienceResult?: GrowthLedgerApplyResult
  }): GrowthRuleRewardSettlementResult {
    const ledgerRecordIds = [
      params.pointsResult?.recordId,
      params.experienceResult?.recordId,
    ].filter((id): id is number => typeof id === 'number')
    const results = [params.pointsResult, params.experienceResult]
    const denied = results.some(
      (result) => result && !result.success && !result.duplicated,
    )

    return {
      success: !denied,
      source: GrowthLedgerSourceEnum.GROWTH_RULE,
      bizKey: params.params.bizKey,
      ruleType: params.params.ruleType,
      dedupeResult: this.resolveRuleRewardDedupeResult(results),
      ledgerRecordIds,
      pointsResult: params.pointsResult,
      experienceResult: params.experienceResult,
    }
  }

  private resolveRuleRewardDedupeResult(
    results: Array<GrowthLedgerApplyResult | undefined>,
  ) {
    const attemptedResults = results.filter(
      (result): result is GrowthLedgerApplyResult => Boolean(result),
    )

    if (attemptedResults.some((item) => item.success && !item.duplicated)) {
      return GrowthRewardDedupeResultEnum.APPLIED
    }
    if (attemptedResults.length > 0 && attemptedResults.every((item) => item.duplicated)) {
      return GrowthRewardDedupeResultEnum.IDEMPOTENT
    }
    return GrowthRewardDedupeResultEnum.SKIPPED
  }

  private resolveTaskRewardResultType(
    results: TaskRewardAssetResult[],
  ) {
    const attemptedResults = results.filter((item) => !item.skipped)
    if (attemptedResults.length === 0) {
      return TaskAssignmentRewardResultTypeEnum.APPLIED
    }
    if (attemptedResults.every((item) => item.duplicated)) {
      return TaskAssignmentRewardResultTypeEnum.IDEMPOTENT
    }
    return TaskAssignmentRewardResultTypeEnum.APPLIED
  }

  private toTaskRewardDedupeResult(
    resultType: TaskAssignmentRewardResultTypeEnum,
  ) {
    if (resultType === TaskAssignmentRewardResultTypeEnum.IDEMPOTENT) {
      return GrowthRewardDedupeResultEnum.IDEMPOTENT
    }
    if (resultType === TaskAssignmentRewardResultTypeEnum.FAILED) {
      return GrowthRewardDedupeResultEnum.FAILED
    }
    return GrowthRewardDedupeResultEnum.APPLIED
  }

  private toTaskRewardAssetResult(
    assetType: GrowthAssetTypeEnum.POINTS | GrowthAssetTypeEnum.EXPERIENCE,
    configuredAmount: number,
    result?: GrowthLedgerApplyResult,
    forceFailed = false,
  ): TaskRewardAssetResult {
    if (configuredAmount <= 0) {
      return {
        assetType,
        configuredAmount,
        success: true,
        duplicated: false,
        skipped: true,
        reason: 'not_configured',
      }
    }

    if (forceFailed) {
      return {
        assetType,
        configuredAmount,
        success: false,
        duplicated: false,
        skipped: false,
        reason: result?.reason,
      }
    }

    return {
      assetType,
      configuredAmount,
      success: Boolean(result?.success),
      duplicated: Boolean(result?.duplicated),
      skipped: false,
      recordId: result?.recordId,
      reason: result?.reason,
    }
  }

  private ensureTaskRewardApplySucceeded(
    assetLabel: '积分' | '经验',
    assetType: GrowthAssetTypeEnum.POINTS | GrowthAssetTypeEnum.EXPERIENCE,
    result?: GrowthLedgerApplyResult,
  ) {
    if (!result || (result.success && !result.duplicated) || result.duplicated) {
      return
    }

    throw new Error(this.buildTaskRewardRejectedMessage(assetLabel, assetType, result))
  }

  private buildTaskRewardRejectedMessage(
    assetLabel: '积分' | '经验',
    assetType: GrowthAssetTypeEnum.POINTS | GrowthAssetTypeEnum.EXPERIENCE,
    result: GrowthLedgerApplyResult,
  ) {
    const assetName =
      assetType === GrowthAssetTypeEnum.POINTS ? 'POINTS' : 'EXPERIENCE'

    return `任务奖励发放失败（${assetLabel}/${assetName}）：${
      result.reason ? GrowthLedgerFailReasonLabel[result.reason] : '未知原因'
    }`
  }

  private buildTaskRewardContext(params: RewardTaskCompleteParams) {
    const context =
      this.asRecord(params.eventEnvelope?.context)
      ?? {
        taskId: params.taskId,
        assignmentId: params.assignmentId,
      }

    return {
      ...context,
      taskId: params.taskId,
      assignmentId: params.assignmentId,
      eventCode: params.eventEnvelope?.code,
      eventKey: params.eventEnvelope?.key,
      governanceStatus: params.eventEnvelope?.governanceStatus,
    }
  }

  private buildRuleRewardContext(params: RewardByRuleParams) {
    if (!params.context && !params.source) {
      return undefined
    }

    return {
      ...(params.context ?? {}),
      rewardSource: params.source,
    }
  }

  private async runWithOptionalTransaction<T>(
    tx: Db | undefined,
    callback: (runner: Db) => Promise<T>,
  ) {
    if (tx) {
      return callback(tx)
    }
    return this.drizzle.withTransaction(callback)
  }

  /** 解析奖励配置 */
  private parseRewardConfig(input: unknown) {
    const record = this.asRecord(input)
    if (!record) {
      return { points: 0, experience: 0 }
    }

    return {
      points: this.readPositiveInt(record.points),
      experience: this.readPositiveInt(record.experience),
    }
  }

  private asRecord(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as Record<string, unknown>
  }

  private readPositiveInt(input: unknown) {
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
