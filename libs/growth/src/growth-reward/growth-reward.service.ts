import type { Db } from '@db/core'
import type { JsonObject } from '@libs/platform/utils'
import type { GrowthLedgerApplyResult } from '../growth-ledger/growth-ledger.internal'
import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  GrowthRewardItem,
  GrowthRewardItems,
} from '../reward-rule/reward-item.type'
import type {
  GrowthRewardApplyResultList,
  GrowthRuleRewardAssetResult,
  GrowthRuleRewardSettlementResult,
  TaskRewardAssetResult,
  TaskRewardSettlementResult,
} from './types/growth-reward-result.type'
import type {
  BuildRuleRewardSettlementResultParams,
  BuildTaskRewardSettlementResultParams,
  GrowthRewardRuleAssetIdentity,
  GrowthRewardRuleProjection,
  RewardByRuleParams,
  RewardTaskCompleteParams,
  RunWithOptionalTransactionCallback,
} from './types/growth-reward-service.type'
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
import { GrowthRewardRuleAssetTypeEnum } from '../reward-rule/reward-rule.constant'
import { TaskRewardSettlementResultTypeEnum } from '../task/task.constant'
import {
  GrowthRewardDedupeResultEnum,
  TaskRewardAssetSkipReasonEnum,
} from './types/growth-reward-result.type'

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

  // 统一收口成长奖励规则表访问。
  private get growthRewardRule() {
    return this.drizzle.schema.growthRewardRule
  }

  // 按事件规则逐项发放奖励，并把多资产落账结果收口成统一结算结果。
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
            assetType: this.toLedgerRuleAssetType(rewardRule.assetType),
            assetKey: rewardRule.assetKey,
            ruleType: params.ruleType,
            bizKey: this.buildRuleRewardBizKey(params.bizKey, rewardRule),
            source: GrowthLedgerSourceEnum.GROWTH_RULE,
            targetType: params.targetType,
            targetId: params.targetId,
            context: this.buildRuleRewardContext(params),
            occurredAt: params.occurredAt,
          })
          rewardResults.push({
            assetType: rewardRule.assetType,
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

  // 为被规则拒绝的奖励落账补齐诊断日志，避免补偿链路只留下空泛失败信息。
  private logSkippedRuleReward(
    params: RewardByRuleParams,
    rewardRule: GrowthRewardRuleAssetIdentity,
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

  // 规则奖励只允许成功或幂等命中，其他结果一律抛错交给补偿链路接管。
  private ensureRuleRewardApplySucceeded(
    params: RewardByRuleParams,
    rewardRule: GrowthRewardRuleAssetIdentity,
    result?: GrowthLedgerApplyResult,
  ) {
    if (
      !result ||
      (result.success && !result.duplicated) ||
      result.duplicated
    ) {
      return
    }

    this.logSkippedRuleReward(params, rewardRule, result)

    throw new Error(this.buildRuleRewardRejectedMessage(rewardRule, result))
  }

  // 把规则拒绝原因规整成稳定可观测的错误消息。
  private buildRuleRewardRejectedMessage(
    rewardRule: GrowthRewardRuleAssetIdentity,
    result: GrowthLedgerApplyResult,
  ) {
    return `基础奖励发放失败（assetType=${rewardRule.assetType} assetKey=${rewardRule.assetKey || ''}）：${
      result.reason ? GrowthLedgerFailReasonLabel[result.reason] : '未知原因'
    }`
  }

  // 根据统一 rewardItems 合同逐项发放任务完成奖励，并维护任务奖励幂等语义。
  async tryRewardTaskComplete(
    params: RewardTaskCompleteParams,
  ): Promise<TaskRewardSettlementResult> {
    const settledAt = new Date()
    const rewardItems = this.parseRewardItems(params.rewardItems)
    const baseBizKey = [
      'task',
      'complete',
      params.taskId,
      'instance',
      params.instanceId,
      'user',
      params.userId,
    ].join(':')
    if (rewardItems.length === 0) {
      return this.buildTaskRewardSettlementResult({
        bizKey: baseBizKey,
        rewardItems,
        settledAt,
        rewardResults: [],
        resultType: TaskRewardSettlementResultTypeEnum.APPLIED,
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
            targetId: params.taskId,
            context,
          })

          this.ensureTaskRewardApplySucceeded(rewardItem, applyResult)
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
        `reward_task_complete_failed userId=${params.userId} taskId=${params.taskId} instanceId=${params.instanceId} eventKey=${params.eventEnvelope?.key ?? 'TASK_COMPLETE'} error=${
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
        resultType: TaskRewardSettlementResultTypeEnum.FAILED,
        errorMessage:
          error instanceof Error
            ? error.message
            : '任务奖励发放失败，请稍后重试',
      })
    }
  }

  // 把任务奖励逐项结果归并成稳定结算返回体。
  private buildTaskRewardSettlementResult(
    params: BuildTaskRewardSettlementResultParams,
  ): TaskRewardSettlementResult {
    const ledgerRecordIds = params.rewardResults
      .map((reward) => reward.recordId)
      .filter((id): id is number => typeof id === 'number')

    return {
      success: params.resultType !== TaskRewardSettlementResultTypeEnum.FAILED,
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

  // 把规则奖励逐项落账结果归并成统一结算结果。
  private buildRuleRewardSettlementResult(
    params: BuildRuleRewardSettlementResultParams,
  ): GrowthRuleRewardSettlementResult {
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

  // 根据逐项落账结果归并通用成长奖励的幂等结论。
  private resolveRuleRewardDedupeResult(results: GrowthRewardApplyResultList) {
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

  // 根据逐项任务奖励结果判断整体结算类型。
  private resolveTaskRewardResultType(results: TaskRewardAssetResult[]) {
    const attemptedResults = results.filter((item) => !item.skipped)
    if (attemptedResults.length === 0) {
      return TaskRewardSettlementResultTypeEnum.APPLIED
    }
    if (attemptedResults.every((item) => item.duplicated)) {
      return TaskRewardSettlementResultTypeEnum.IDEMPOTENT
    }
    return TaskRewardSettlementResultTypeEnum.APPLIED
  }

  // 把任务奖励结果类型映射成通用补偿链路使用的幂等结果。
  private toTaskRewardDedupeResult(
    resultType: TaskRewardSettlementResultTypeEnum,
  ) {
    if (resultType === TaskRewardSettlementResultTypeEnum.IDEMPOTENT) {
      return GrowthRewardDedupeResultEnum.IDEMPOTENT
    }
    if (resultType === TaskRewardSettlementResultTypeEnum.FAILED) {
      return GrowthRewardDedupeResultEnum.FAILED
    }
    return GrowthRewardDedupeResultEnum.APPLIED
  }

  // 把账本逐项落账结果转换成任务奖励项级别的稳定视图。
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
        reason: TaskRewardAssetSkipReasonEnum.NOT_CONFIGURED,
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

  // 任务奖励只允许成功或幂等命中，其他结果统一交给补偿链路处理。
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

  // 把任务奖励拒绝原因转换成稳定错误消息，便于补偿记录和日志统一检索。
  private buildTaskRewardRejectedMessage(
    assetType: GrowthRewardRuleAssetTypeEnum,
    result: GrowthLedgerApplyResult,
  ) {
    return `任务奖励发放失败（${this.buildTaskRewardAssetLabel(assetType)}）：${
      result.reason ? GrowthLedgerFailReasonLabel[result.reason] : '未知原因'
    }`
  }

  // 规整任务奖励上下文，缺省时补齐 task instance 与 task 的最小事实字段。
  private buildTaskRewardContext(params: RewardTaskCompleteParams) {
    const context = this.asJsonObject(params.eventEnvelope?.context) ?? {
      taskId: params.taskId,
      instanceId: params.instanceId,
    }

    return {
      ...context,
      taskId: params.taskId,
      instanceId: params.instanceId,
      eventCode: params.eventEnvelope?.code,
      eventKey: params.eventEnvelope?.key,
      governanceStatus: params.eventEnvelope?.governanceStatus,
      rewardItems: params.rewardItems ?? null,
    }
  }

  // 规整规则奖励上下文，并补写统一的 rewardSource 字段。
  private buildRuleRewardContext(params: RewardByRuleParams) {
    if (!params.context && !params.source) {
      return undefined
    }

    return {
      ...(params.context ?? {}),
      rewardSource: params.source,
    }
  }

  // 读取指定事件规则下启用判断所需的最小奖励规则字段。
  private async listRewardRulesByType(
    tx: Db,
    ruleType: GrowthRuleTypeEnum,
  ): Promise<GrowthRewardRuleProjection[]> {
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

  // 为同一业务事实下的不同资产生成稳定幂等键。
  private buildRuleRewardBizKey(
    bizKey: string,
    rewardRule: GrowthRewardRuleAssetIdentity,
  ) {
    return `${bizKey}:asset:${rewardRule.assetType}:${rewardRule.assetKey || ''}`
  }

  // 已有事务时直接复用，否则由奖励服务自行开启事务。
  private async runWithOptionalTransaction<T>(
    tx: Db | undefined,
    callback: RunWithOptionalTransactionCallback<T>,
  ) {
    if (tx) {
      return callback(tx)
    }
    return this.drizzle.withTransaction(callback)
  }

  // 解析任务奖励项快照，只接收任务链路允许的积分/经验资产。
  private parseRewardItems(input: unknown): GrowthRewardItems {
    if (!Array.isArray(input)) {
      return []
    }

    return input.flatMap((item) => {
      const record = this.asJsonObject(item)
      if (!record) {
        return []
      }

      const assetType = this.readTaskRewardAssetType(record.assetType)
      if (assetType === null) {
        return []
      }

      const amount = this.readPositiveInt(record.amount)
      if (amount <= 0) {
        return []
      }

      return [
        {
          assetType,
          assetKey:
            typeof record.assetKey === 'string' ? record.assetKey.trim() : '',
          amount,
        },
      ]
    })
  }

  // 为任务奖励单个资产生成稳定幂等键，避免积分与经验互相覆盖。
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

  // 生成任务奖励失败日志里的资产中文标签。
  private buildTaskRewardAssetLabel(assetType: GrowthRewardRuleAssetTypeEnum) {
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? '积分/POINTS'
      : '经验/EXPERIENCE'
  }

  // 把奖励规则资产类型映射为账本资产类型，避免使用不安全的双重断言。
  private toLedgerRuleAssetType(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ): GrowthAssetTypeEnum {
    switch (assetType) {
      case GrowthRewardRuleAssetTypeEnum.POINTS:
        return GrowthAssetTypeEnum.POINTS
      case GrowthRewardRuleAssetTypeEnum.EXPERIENCE:
        return GrowthAssetTypeEnum.EXPERIENCE
      case GrowthRewardRuleAssetTypeEnum.ITEM:
        return GrowthAssetTypeEnum.ITEM
      case GrowthRewardRuleAssetTypeEnum.CURRENCY:
        return GrowthAssetTypeEnum.CURRENCY
      case GrowthRewardRuleAssetTypeEnum.LEVEL:
        return GrowthAssetTypeEnum.LEVEL
      default:
        throw new Error(`基础奖励资产类型不受支持：${assetType}`)
    }
  }

  // 把任务链路允许的奖励资产映射为账本资产类型，并拒绝越界资产。
  private toLedgerAssetType(
    assetType: GrowthRewardRuleAssetTypeEnum,
  ): GrowthAssetTypeEnum {
    if (
      assetType !== GrowthRewardRuleAssetTypeEnum.POINTS &&
      assetType !== GrowthRewardRuleAssetTypeEnum.EXPERIENCE
    ) {
      throw new Error(`任务奖励资产类型不受支持：${assetType}`)
    }
    return assetType === GrowthRewardRuleAssetTypeEnum.POINTS
      ? GrowthAssetTypeEnum.POINTS
      : GrowthAssetTypeEnum.EXPERIENCE
  }

  // 仅在输入为普通 JSON 对象时返回对象视图，避免数组和原始值误入上下文拼装。
  private asJsonObject(input: unknown): JsonObject | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return null
    }
    return input as JsonObject
  }

  // 从松散输入中读取正整数，非法值统一回落为 0。
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

  // 从任务奖励快照里读取当前链路允许的资产类型。
  private readTaskRewardAssetType(
    input: unknown,
  ):
    | GrowthRewardRuleAssetTypeEnum.POINTS
    | GrowthRewardRuleAssetTypeEnum.EXPERIENCE
    | null {
    const assetType = Number(input)
    if (assetType === GrowthRewardRuleAssetTypeEnum.POINTS) {
      return GrowthRewardRuleAssetTypeEnum.POINTS
    }
    if (assetType === GrowthRewardRuleAssetTypeEnum.EXPERIENCE) {
      return GrowthRewardRuleAssetTypeEnum.EXPERIENCE
    }
    return null
  }
}
