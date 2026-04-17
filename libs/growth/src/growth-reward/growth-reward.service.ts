import type { Db } from '@db/core'
import type { EventEnvelope } from '@libs/growth/event-definition/event-envelope.type'
import type { JsonObject } from '@libs/platform/utils/jsonParse'
import type { GrowthLedgerApplyResult } from '../growth-ledger/growth-ledger.internal'
import type { GrowthRewardItem, GrowthRewardItems } from '../reward-rule/reward-item.type'
import type {
  GrowthRuleRewardAssetResult,
  GrowthRuleRewardSettlementResult,
  TaskRewardAssetResult,
  TaskRewardSettlementResult,
} from './growth-reward.types'
import { DrizzleService } from '@db/core'
import { Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import {
  GrowthAssetTypeEnum,
  GrowthLedgerActionEnum,
  GrowthLedgerFailReasonEnum,
  GrowthLedgerFailReasonLabel,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import { GrowthLedgerService } from '../growth-ledger/growth-ledger.service'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
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
  rewardItems?: GrowthRewardItems | null
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

  private get growthRewardRule() {
    return this.drizzle.schema.growthRewardRule
  }

  /**
   * 按规则类型发放奖励。
   * 统一遍历规则表中该事件已配置的所有资产，不再只固定处理积分/经验双分支。
   */
  async tryRewardByRule(
    params: RewardByRuleParams,
  ): Promise<GrowthRuleRewardSettlementResult> {
    const rewardRules = await this.listRewardRulesByType(
      params.tx ?? this.drizzle.db,
      params.ruleType,
    )

    if (rewardRules.length === 0) {
      return {
        success: false,
        source: GrowthLedgerSourceEnum.GROWTH_RULE,
        bizKey: params.bizKey,
        ruleType: params.ruleType,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        ledgerRecordIds: [],
        failureReason: GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
        rewardResults: [],
        errorMessage: '基础奖励规则不存在',
      }
    }

    const enabledRules = rewardRules.filter((item) => item.isEnabled)
    if (enabledRules.length === 0) {
      return {
        success: false,
        source: GrowthLedgerSourceEnum.GROWTH_RULE,
        bizKey: params.bizKey,
        ruleType: params.ruleType,
        dedupeResult: GrowthRewardDedupeResultEnum.FAILED,
        ledgerRecordIds: [],
        failureReason: GrowthLedgerFailReasonEnum.RULE_DISABLED,
        rewardResults: [],
        errorMessage: '规则已禁用',
      }
    }
    const rewardResults: GrowthRuleRewardAssetResult[] = []

    try {
      await this.runWithOptionalTransaction(params.tx, async (tx) => {
        for (const rewardRule of enabledRules) {
          const result = await this.growthLedgerService.applyByRule(tx, {
            userId: params.userId,
            assetType: rewardRule.assetType as unknown as GrowthAssetTypeEnum,
            assetKey: rewardRule.assetKey,
            ruleType: params.ruleType,
            bizKey: this.buildRuleRewardBizKey(params.bizKey, rewardRule),
            source: GrowthLedgerSourceEnum.GROWTH_RULE,
            remark: params.remark,
            targetType: params.targetType,
            targetId: params.targetId,
            context: this.buildRuleRewardContext(params),
            occurredAt: params.occurredAt,
          })
          rewardResults.push({
            assetType: rewardRule.assetType as GrowthRewardRuleAssetTypeEnum,
            assetKey: rewardRule.assetKey,
            result,
          })
          this.ensureRuleRewardApplySucceeded(params, rewardRule, result)
        }
      })

      return this.buildRuleRewardSettlementResult({
        params,
        rewardResults,
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
        ledgerRecordIds: rewardResults
          .map((item) => item.result.recordId)
          .filter((id): id is number => typeof id === 'number'),
        failureReason: rewardResults.find((item) => item.result.reason)?.result.reason,
        rewardResults,
        errorMessage:
          error instanceof Error
            ? error.message
            : '基础奖励发放失败，请稍后重试',
      }
    }
  }

  /**
   * 记录未成功落账的规则奖励结果。
   * 规则缺失、禁用或命中限额时不会抛异常，需要在这里补齐可观测性。
   */
  private logSkippedRuleReward(
    params: RewardByRuleParams,
    rewardRule: {
      assetType: GrowthRewardRuleAssetTypeEnum
      assetKey: string
    },
    result?: GrowthLedgerApplyResult,
  ) {
    if (!result || result.success || result.duplicated) {
      return
    }

    this.logger.warn(
      `reward_by_rule_skipped userId=${params.userId} ruleType=${params.ruleType} bizKey=${params.bizKey} source=${params.source} assetType=${rewardRule.assetType} assetKey=${rewardRule.assetKey || ''} reason=${
        result.reason ?? 'unknown'
      }`,
    )
  }

  private ensureRuleRewardApplySucceeded(
    params: RewardByRuleParams,
    rewardRule: {
      assetType: GrowthRewardRuleAssetTypeEnum
      assetKey: string
    },
    result?: GrowthLedgerApplyResult,
  ) {
    if (
      !result ||
      (result.success && !result.duplicated) ||
      result.duplicated
    ) {
      return
    }

    this.logSkippedRuleReward(
      params,
      rewardRule,
      result,
    )

    throw new Error(
      this.buildRuleRewardRejectedMessage(rewardRule, result),
    )
  }

  private buildRuleRewardRejectedMessage(
    rewardRule: {
      assetType: GrowthRewardRuleAssetTypeEnum
      assetKey: string
    },
    result: GrowthLedgerApplyResult,
  ) {
    return `基础奖励发放失败（assetType=${rewardRule.assetType} assetKey=${rewardRule.assetKey || ''}）：${
      result.reason ? GrowthLedgerFailReasonLabel[result.reason] : '未知原因'
    }`
  }

  /**
   * 发放任务完成奖励
   * 根据统一 `rewardItems[]` 合同逐项发放任务奖励。
   */
  async tryRewardTaskComplete(
    params: RewardTaskCompleteParams,
  ): Promise<TaskRewardSettlementResult> {
    const settledAt = new Date()
    const rewardItems = this.parseRewardItems(params.rewardItems)
    const baseBizKey = [
      'task',
      'complete',
      params.taskId,
      'assignment',
      params.assignmentId,
      'user',
      params.userId,
    ].join(':')
    if (rewardItems.length === 0) {
      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        rewardItems,
        settledAt,
        rewardResults: [],
        resultType: TaskAssignmentRewardResultTypeEnum.APPLIED,
      })
    }

    const context = this.buildTaskRewardContext(params)

    try {
      const rewardResults: TaskRewardAssetResult[] = []

      await this.drizzle.withTransaction(async (tx) => {
        for (const rewardItem of rewardItems) {
          const ledgerAssetType = this.toLedgerAssetType(rewardItem.assetType)
          const applyResult = await this.growthLedgerService.applyDelta(tx, {
            userId: params.userId,
            assetType: ledgerAssetType,
            action: GrowthLedgerActionEnum.GRANT,
            amount: rewardItem.amount,
            bizKey: this.buildTaskRewardItemBizKey(baseBizKey, rewardItem),
            source: GrowthLedgerSourceEnum.TASK_BONUS,
            remark: this.buildTaskRewardRemark(rewardItem.assetType),
            targetId: params.taskId,
            context,
          })

          this.ensureTaskRewardApplySucceeded(
            rewardItem,
            applyResult,
          )
          rewardResults.push(
            this.toTaskRewardAssetResult(rewardItem, applyResult),
          )
        }
      })

      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        rewardItems,
        settledAt,
        rewardResults,
        resultType: this.resolveTaskRewardResultType(rewardResults),
      })
    } catch (error) {
      this.logger.warn(
        `reward_task_complete_failed userId=${params.userId} taskId=${params.taskId} assignmentId=${params.assignmentId} eventKey=${params.eventEnvelope?.key ?? 'TASK_COMPLETE'} error=${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        rewardItems,
        settledAt,
        rewardResults: rewardItems.map((rewardItem) =>
          this.toTaskRewardAssetResult(rewardItem, undefined, true),
        ),
        resultType: TaskAssignmentRewardResultTypeEnum.FAILED,
        errorMessage:
          error instanceof Error
            ? error.message
            : '任务奖励发放失败，请稍后重试',
      })
    }
  }

  private buildTaskRewardSettlementResult(params: {
    bizKey: string
    rewardItems: GrowthRewardItems
    settledAt: Date
    rewardResults: TaskRewardAssetResult[]
    resultType: TaskAssignmentRewardResultTypeEnum
    errorMessage?: string
  }): TaskRewardSettlementResult {
    const ledgerRecordIds = params.rewardResults
      .map((reward) => reward.recordId)
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
      rewardResults: params.rewardResults,
    }
  }

  private buildRuleRewardSettlementResult(params: {
    params: RewardByRuleParams
    rewardResults: GrowthRuleRewardAssetResult[]
  }): GrowthRuleRewardSettlementResult {
    const ledgerRecordIds = params.rewardResults
      .map((item) => item.result.recordId)
      .filter((id): id is number => typeof id === 'number')
    const results = params.rewardResults.map((item) => item.result)
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
      rewardResults: params.rewardResults,
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
    if (
      attemptedResults.length > 0 &&
      attemptedResults.every((item) => item.duplicated)
    ) {
      return GrowthRewardDedupeResultEnum.IDEMPOTENT
    }
    return GrowthRewardDedupeResultEnum.SKIPPED
  }

  private resolveTaskRewardResultType(results: TaskRewardAssetResult[]) {
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
    rewardItem: GrowthRewardItem,
    result?: GrowthLedgerApplyResult,
    forceFailed = false,
  ): TaskRewardAssetResult {
    if (rewardItem.amount <= 0) {
      return {
        assetType: rewardItem.assetType,
        assetKey: rewardItem.assetKey,
        configuredAmount: rewardItem.amount,
        success: true,
        duplicated: false,
        skipped: true,
        reason: 'not_configured',
      }
    }

    if (forceFailed) {
      return {
        assetType: rewardItem.assetType,
        assetKey: rewardItem.assetKey,
        configuredAmount: rewardItem.amount,
        success: false,
        duplicated: false,
        skipped: false,
        reason: result?.reason,
      }
    }

    return {
      assetType: rewardItem.assetType,
      assetKey: rewardItem.assetKey,
      configuredAmount: rewardItem.amount,
      success: Boolean(result?.success),
      duplicated: Boolean(result?.duplicated),
      skipped: false,
      recordId: result?.recordId,
      reason: result?.reason,
    }
  }

  private ensureTaskRewardApplySucceeded(
    rewardItem: GrowthRewardItem,
    result?: GrowthLedgerApplyResult,
  ) {
    if (
      !result ||
      (result.success && !result.duplicated) ||
      result.duplicated
    ) {
      return
    }

    throw new Error(
      this.buildTaskRewardRejectedMessage(rewardItem.assetType, result),
    )
  }

  private buildTaskRewardRejectedMessage(
    assetType: GrowthRewardRuleAssetTypeEnum,
    result: GrowthLedgerApplyResult,
  ) {
    return `任务奖励发放失败（${this.buildTaskRewardAssetLabel(assetType)}）：${
      result.reason ? GrowthLedgerFailReasonLabel[result.reason] : '未知原因'
    }`
  }

  private buildTaskRewardContext(params: RewardTaskCompleteParams) {
    const context = this.asRecord(params.eventEnvelope?.context) ?? {
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
      rewardItems: params.rewardItems ?? null,
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

  private async listRewardRulesByType(tx: Db, ruleType: GrowthRuleTypeEnum) {
    return tx
      .select({
        id: this.growthRewardRule.id,
        assetType: this.growthRewardRule.assetType,
        assetKey: this.growthRewardRule.assetKey,
        isEnabled: this.growthRewardRule.isEnabled,
      })
      .from(this.growthRewardRule)
      .where(eq(this.growthRewardRule.type, ruleType))
  }

  private buildRuleRewardBizKey(
    bizKey: string,
    rewardRule: { assetType: number, assetKey: string },
  ) {
    return `${bizKey}:asset:${rewardRule.assetType}:${rewardRule.assetKey || ''}`
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

  /** 解析任务奖励项列表。当前任务奖励链路只接受积分/经验资产。 */
  private parseRewardItems(input: unknown): GrowthRewardItems {
    if (!Array.isArray(input)) {
      return []
    }

    return input.flatMap((item) => {
      const record = this.asRecord(item)
      if (!record) {
        return []
      }

      const assetType = Number(record.assetType)
      if (
        assetType !== GrowthRewardRuleAssetTypeEnum.POINTS
        && assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE
      ) {
        return []
      }

      const amount = this.readPositiveInt(record.amount)
      if (amount <= 0) {
        return []
      }

      return [{
        assetType,
        assetKey:
          typeof record.assetKey === 'string' ? record.assetKey.trim() : '',
        amount,
      }]
    })
  }

  private buildTaskRewardItemBizKey(
    baseBizKey: string,
    rewardItem: GrowthRewardItem,
  ) {
    const assetSegment =
      rewardItem.assetType === GrowthRewardRuleAssetTypeEnum.POINTS
        ? 'POINTS'
        : 'EXPERIENCE'
    return `${baseBizKey}:${assetSegment}`
  }

  private buildTaskRewardRemark(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ) {
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? '任务完成奖励（积分）'
      : '任务完成奖励（经验）'
  }

  private buildTaskRewardAssetLabel(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ) {
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? '积分/POINTS'
      : '经验/EXPERIENCE'
  }

  private toLedgerAssetType(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ) {
    if (
      assetType !== GrowthRewardRuleAssetTypeEnum.POINTS
      && assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE
    ) {
      throw new Error(`Unsupported task reward asset type: ${assetType}`)
    }
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? GrowthAssetTypeEnum.POINTS
      : GrowthAssetTypeEnum.EXPERIENCE
  }

  private asRecord<T>(input: T): JsonObject | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as JsonObject
  }

  private readPositiveInt<T>(input: T) {
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
