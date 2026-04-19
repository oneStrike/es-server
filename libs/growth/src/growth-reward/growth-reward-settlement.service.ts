import type { Db } from '@db/core'
import type { GrowthRewardSettlementSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type { QueryGrowthRewardSettlementPageDto } from './dto/growth-reward-settlement.dto'
import type {
  DispatchDefinedGrowthEventPayload,
  GrowthRuleRewardSettlementResult,
  SerializedDispatchDefinedGrowthEventPayload,
} from './growth-reward.types'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from './growth-reward.constant'

const NON_RETRYABLE_FAILURE_REASONS = new Set([
  'rule_not_found',
  'rule_disabled',
  'rule_zero',
  'daily_limit',
  'total_limit',
])

/**
 * 通用成长奖励补偿事实服务。
 *
 * 负责 settlement 事实的持久化、查询与状态同步，不负责跨域重试编排。
 */
@Injectable()
export class GrowthRewardSettlementService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.db
  }

  private get growthRewardSettlement() {
    return this.drizzle.schema.growthRewardSettlement
  }

  /**
   * 记录抛异常导致的奖励失败。
   * 该类失败默认视为可重试，写入待补偿状态。
   */
  async recordExceptionSettlement(
    input: DispatchDefinedGrowthEventPayload,
    error: unknown,
  ) {
    const message = error instanceof Error ? error.message : String(error)
    await this.upsertGrowthEventSettlement(input, {
      settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
      settlementResultType: GrowthRewardSettlementResultTypeEnum.FAILED,
      ledgerRecordIds: [],
      lastError: message,
    })
  }

  /**
   * 记录未成功落账的基础奖励结果。
   * 能明确判定为规则拒绝的场景记为终态失败，其余保持待补偿。
   */
  async recordUnsuccessfulSettlement(
    input: DispatchDefinedGrowthEventPayload,
    growthResult: GrowthRuleRewardSettlementResult,
  ) {
    const settlementStatus = this.resolveFailureStatus(growthResult)
    await this.upsertGrowthEventSettlement(input, {
      settlementStatus,
      settlementResultType: GrowthRewardSettlementResultTypeEnum.FAILED,
      ledgerRecordIds: growthResult.ledgerRecordIds,
      lastError:
        growthResult.errorMessage ??
        (settlementStatus === GrowthRewardSettlementStatusEnum.TERMINAL
          ? '奖励规则拒绝落账'
          : '基础奖励发放失败'),
    })
  }

  /**
   * 若此前存在失败事实，则在自然重试或人工补偿成功后关闭记录。
   */
  async markSettlementSucceeded(
    userId: number,
    bizKey: string,
    growthResult: GrowthRuleRewardSettlementResult,
  ) {
    const record = await this.db.query.growthRewardSettlement.findFirst({
      where: {
        userId,
        bizKey,
      },
    })
    if (!record) {
      return
    }
    await this.updateSettlementState(record.id, {
      settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
      settlementResultType: this.resolveSuccessResultType(growthResult),
      ledgerRecordIds: growthResult.ledgerRecordIds,
      retryCount: record.retryCount,
      lastRetryAt: record.lastRetryAt,
      settledAt: new Date(),
      lastError: null,
    })
  }

  /**
   * 分页查询通用成长奖励补偿记录。
   */
  async getSettlementPage(query: QueryGrowthRewardSettlementPageDto) {
    const conditions: SQL[] = []

    if (query.userId !== undefined) {
      conditions.push(eq(this.growthRewardSettlement.userId, query.userId))
    }
    if (query.settlementType !== undefined) {
      conditions.push(
        eq(this.growthRewardSettlement.settlementType, query.settlementType),
      )
    }
    if (query.eventCode !== undefined && query.eventCode !== null) {
      conditions.push(
        eq(this.growthRewardSettlement.eventCode, query.eventCode),
      )
    }
    if (query.settlementStatus !== undefined) {
      conditions.push(
        eq(
          this.growthRewardSettlement.settlementStatus,
          query.settlementStatus,
        ),
      )
    }

    const orderBy = query.orderBy?.trim()
      ? query.orderBy
      : JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }])

    return this.drizzle.ext.findPagination(this.growthRewardSettlement, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...query,
      orderBy,
    })
  }

  /**
   * 按主键读取单条 settlement。
   */
  async getSettlementById(id: number) {
    return this.db.query.growthRewardSettlement.findFirst({
      where: { id },
    })
  }

  /**
   * 分页批量扫描 pending settlement 主键。
   */
  async listPendingSettlementIds(limit: number) {
    return this.db
      .select({ id: this.growthRewardSettlement.id })
      .from(this.growthRewardSettlement)
      .where(
        eq(
          this.growthRewardSettlement.settlementStatus,
          GrowthRewardSettlementStatusEnum.PENDING,
        ),
      )
      .orderBy(this.growthRewardSettlement.id)
      .limit(limit)
  }

  async ensureCheckInRecordRewardSettlement(
    params: {
      recordId: number
      userId: number
      configId: number
      signDate: string
      rewardItems?: Record<string, unknown>[] | null
    },
    tx?: Db,
  ) {
    const bizKey = [
      'checkin',
      'base',
      'record',
      params.recordId,
      'user',
      params.userId,
    ].join(':')
    const requestPayload = {
      kind: 'check_in_record_reward',
      recordId: params.recordId,
      userId: params.userId,
      configId: params.configId,
      signDate: params.signDate,
      rewardItems: params.rewardItems ?? null,
    }

    return this.ensureManualSettlement(
      {
        userId: params.userId,
        bizKey,
        settlementType: GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD,
        source: 'check_in_base_bonus',
        sourceRecordId: params.recordId,
        eventOccurredAt: new Date(`${params.signDate}T00:00:00.000Z`),
        requestPayload,
      },
      tx,
    )
  }

  async ensureCheckInStreakRewardSettlement(
    params: {
      grantId: number
      userId: number
      roundConfigId: number
      ruleCode: string
      triggerSignDate: string
      rewardItems?: Record<string, unknown>[] | null
    },
    tx?: Db,
  ) {
    const bizKey = [
      'checkin',
      'streak',
      'grant',
      params.grantId,
      'rule',
      params.ruleCode,
      'user',
      params.userId,
    ].join(':')
    const requestPayload = {
      kind: 'check_in_streak_reward',
      grantId: params.grantId,
      userId: params.userId,
      roundConfigId: params.roundConfigId,
      ruleCode: params.ruleCode,
      triggerSignDate: params.triggerSignDate,
      rewardItems: params.rewardItems ?? null,
    }

    return this.ensureManualSettlement(
      {
        userId: params.userId,
        bizKey,
        settlementType: GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD,
        source: 'check_in_streak_bonus',
        sourceRecordId: params.grantId,
        eventOccurredAt: new Date(`${params.triggerSignDate}T00:00:00.000Z`),
        requestPayload,
      },
      tx,
    )
  }

  async syncManualSettlementResult(
    settlementId: number,
    result: {
      success: boolean
      resultType: number
      ledgerRecordIds: number[]
      errorMessage?: string | null
    },
    options?: { isRetry?: boolean, tx?: Db },
  ) {
    const runner = options?.tx ?? this.db
    const current = await runner.query.growthRewardSettlement.findFirst({
      where: { id: settlementId },
      columns: {
        retryCount: true,
        lastRetryAt: true,
      },
    })

    if (!current) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '奖励补偿记录不存在',
      )
    }

    await this.updateSettlementState(
      settlementId,
      {
        settlementStatus: result.success
          ? GrowthRewardSettlementStatusEnum.SUCCESS
          : GrowthRewardSettlementStatusEnum.PENDING,
        settlementResultType:
          result.resultType as GrowthRewardSettlementResultTypeEnum,
        ledgerRecordIds: result.ledgerRecordIds,
        retryCount: options?.isRetry
          ? current.retryCount + 1
          : current.retryCount,
        lastRetryAt: options?.isRetry ? new Date() : current.lastRetryAt,
        settledAt: result.success ? new Date() : null,
        lastError: result.success
          ? null
          : (result.errorMessage ?? '奖励补偿失败'),
      },
      options?.tx,
    )
  }

  private async ensureManualSettlement(
    params: {
      userId: number
      bizKey: string
      settlementType: GrowthRewardSettlementTypeEnum
      source: string
      sourceRecordId: number
      eventOccurredAt: Date
      requestPayload: Record<string, unknown>
    },
    tx?: Db,
  ) {
    const runner = tx ?? this.db
    const rows = await this.drizzle.withErrorHandling(() =>
      runner
        .insert(this.growthRewardSettlement)
        .values({
          userId: params.userId,
          bizKey: params.bizKey,
          settlementType: params.settlementType,
          source: params.source,
          sourceRecordId: params.sourceRecordId,
          eventOccurredAt: params.eventOccurredAt,
          settlementStatus: GrowthRewardSettlementStatusEnum.PENDING,
          requestPayload: params.requestPayload,
        })
        .onConflictDoNothing({
          target: [
            this.growthRewardSettlement.userId,
            this.growthRewardSettlement.bizKey,
          ],
        })
        .returning({
          id: this.growthRewardSettlement.id,
          bizKey: this.growthRewardSettlement.bizKey,
        }),
    )

    if (rows[0]) {
      return rows[0]
    }

    const existing = await runner.query.growthRewardSettlement.findFirst({
      where: {
        userId: params.userId,
        bizKey: params.bizKey,
      },
      columns: {
        id: true,
        bizKey: true,
      },
    })

    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '奖励补偿记录创建失败',
      )
    }

    return existing
  }

  private async upsertGrowthEventSettlement(
    input: DispatchDefinedGrowthEventPayload,
    payload: {
      settlementStatus: GrowthRewardSettlementStatusEnum
      settlementResultType: GrowthRewardSettlementResultTypeEnum
      ledgerRecordIds: number[]
      lastError: string
    },
  ) {
    const requestPayload = this.serializePayload(input)
    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.growthRewardSettlement)
        .values({
          userId: input.eventEnvelope.subjectId,
          bizKey: input.bizKey,
          settlementType: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
          sourceRecordId: null,
          eventCode: input.eventEnvelope.code,
          eventKey: input.eventEnvelope.key,
          source: input.source,
          targetType: input.targetType,
          targetId: input.targetId ?? input.eventEnvelope.targetId,
          eventOccurredAt: input.eventEnvelope.occurredAt,
          settlementStatus: payload.settlementStatus,
          settlementResultType: payload.settlementResultType,
          ledgerRecordIds: payload.ledgerRecordIds,
          lastError: payload.lastError,
          requestPayload,
        })
        .onConflictDoUpdate({
          target: [
            this.growthRewardSettlement.userId,
            this.growthRewardSettlement.bizKey,
          ],
          set: {
            settlementType: GrowthRewardSettlementTypeEnum.GROWTH_EVENT,
            sourceRecordId: null,
            eventCode: input.eventEnvelope.code,
            eventKey: input.eventEnvelope.key,
            source: input.source,
            targetType: input.targetType,
            targetId: input.targetId ?? input.eventEnvelope.targetId,
            eventOccurredAt: input.eventEnvelope.occurredAt,
            settlementStatus: payload.settlementStatus,
            settlementResultType: payload.settlementResultType,
            ledgerRecordIds: payload.ledgerRecordIds,
            lastError: payload.lastError,
            requestPayload,
            settledAt: null,
          },
        }),
    )
  }

  async updateSettlementState(
    id: number,
    payload: Pick<
      GrowthRewardSettlementSelect,
      | 'settlementResultType'
      | 'ledgerRecordIds'
      | 'settlementStatus'
      | 'retryCount'
      | 'lastRetryAt'
      | 'settledAt'
      | 'lastError'
    >,
    tx?: Db,
  ) {
    const runner = tx ?? this.db
    await this.drizzle.withErrorHandling(() =>
      runner
        .update(this.growthRewardSettlement)
        .set(payload)
        .where(eq(this.growthRewardSettlement.id, id)),
    )
  }

  private resolveFailureStatus(growthResult: GrowthRuleRewardSettlementResult) {
    if (
      growthResult.failureReason &&
      NON_RETRYABLE_FAILURE_REASONS.has(growthResult.failureReason)
    ) {
      return GrowthRewardSettlementStatusEnum.TERMINAL
    }

    const results = growthResult.rewardResults
      .map((item) => item.result)
      .filter((item) => item !== undefined)

    if (
      results.length > 0 &&
      results.every(
        (item) =>
          item.success !== true &&
          item.duplicated !== true &&
          item.reason !== undefined &&
          NON_RETRYABLE_FAILURE_REASONS.has(item.reason),
      )
    ) {
      return GrowthRewardSettlementStatusEnum.TERMINAL
    }

    return GrowthRewardSettlementStatusEnum.PENDING
  }

  private resolveSuccessResultType(
    growthResult: GrowthRuleRewardSettlementResult,
  ) {
    if (growthResult.dedupeResult === 'idempotent') {
      return GrowthRewardSettlementResultTypeEnum.IDEMPOTENT
    }
    return GrowthRewardSettlementResultTypeEnum.APPLIED
  }

  private serializePayload(
    input: DispatchDefinedGrowthEventPayload,
  ): SerializedDispatchDefinedGrowthEventPayload {
    return {
      eventEnvelope: {
        code: input.eventEnvelope.code,
        key: input.eventEnvelope.key,
        subjectType: String(input.eventEnvelope.subjectType),
        subjectId: input.eventEnvelope.subjectId,
        targetType: String(input.eventEnvelope.targetType),
        targetId: input.eventEnvelope.targetId,
        operatorId: input.eventEnvelope.operatorId,
        occurredAt: input.eventEnvelope.occurredAt.toISOString(),
        governanceStatus: String(input.eventEnvelope.governanceStatus),
        context: input.eventEnvelope.context,
      },
      bizKey: input.bizKey,
      source: input.source,
      remark: input.remark,
      targetType: input.targetType,
      targetId: input.targetId,
      context: input.context,
    }
  }
}
