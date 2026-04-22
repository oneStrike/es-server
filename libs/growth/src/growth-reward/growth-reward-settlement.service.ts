import type { Db } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type {
  GrowthRewardSettlementCheckInRecordRewardPayloadDto,
  GrowthRewardSettlementCheckInStreakRewardPayloadDto,
  QueryGrowthRewardSettlementPageDto,
} from './dto/growth-reward-settlement.dto'
import type {
  EnsureCheckInRecordRewardSettlementParams,
  EnsureCheckInStreakRewardSettlementParams,
  EnsureManualSettlementParams,
  SyncManualSettlementResultInput,
  SyncManualSettlementResultOptions,
  UpdateSettlementStatePayload,
  UpsertGrowthEventSettlementPayload,
} from './types/growth-reward-settlement.type'
import type { DispatchDefinedGrowthEventPayload } from './types/growth-event-dispatch.type'
import type { GrowthRuleRewardSettlementResult } from './types/growth-reward-result.type'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  GrowthLedgerFailReasonEnum,
  GrowthLedgerSourceEnum,
} from '../growth-ledger/growth-ledger.constant'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
  GrowthRewardSettlementTypeEnum,
} from './growth-reward.constant'
import { GrowthRewardDedupeResultEnum } from './types/growth-reward-result.type'

const NON_RETRYABLE_FAILURE_REASONS = new Set<GrowthLedgerFailReasonEnum>([
  GrowthLedgerFailReasonEnum.RULE_NOT_FOUND,
  GrowthLedgerFailReasonEnum.RULE_DISABLED,
  GrowthLedgerFailReasonEnum.RULE_ZERO,
  GrowthLedgerFailReasonEnum.DAILY_LIMIT,
  GrowthLedgerFailReasonEnum.TOTAL_LIMIT,
])

/**
 * 通用成长奖励补偿事实服务。
 *
 * 负责 settlement 事实的持久化、查询与状态同步，不负责跨域重试编排。
 */
@Injectable()
export class GrowthRewardSettlementService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 统一收口默认数据库句柄。
  private get db() {
    return this.drizzle.db
  }

  // 统一收口奖励补偿事实表访问。
  private get growthRewardSettlement() {
    return this.drizzle.schema.growthRewardSettlement
  }

  // 记录执行异常导致的奖励失败，并把该事实标记为待补偿重试。
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

  // 记录规则拒绝或落账未成功的基础奖励结果，并收口最终补偿状态。
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

  // 若此前存在失败事实，则在自然重试或人工补偿成功后关闭该记录。
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

  // 按查询条件分页读取通用成长奖励补偿记录。
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

  // 按主键读取单条补偿记录。
  async getSettlementById(id: number) {
    return this.db.query.growthRewardSettlement.findFirst({
      where: { id },
    })
  }

  // 扫描待补偿记录主键，供批量重试链路逐条处理。
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

  // 为签到基础奖励补齐唯一补偿事实，避免 record 与 settlement 状态脱节。
  async ensureCheckInRecordRewardSettlement(
    params: EnsureCheckInRecordRewardSettlementParams,
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
    const requestPayload: GrowthRewardSettlementCheckInRecordRewardPayloadDto =
      {
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
        source: GrowthLedgerSourceEnum.CHECK_IN_BASE_BONUS,
        sourceRecordId: params.recordId,
        eventOccurredAt: new Date(`${params.signDate}T00:00:00.000Z`),
        requestPayload,
      },
      tx,
    )
  }

  // 为连续签到奖励补齐唯一补偿事实，避免 grant 与 settlement 状态脱节。
  async ensureCheckInStreakRewardSettlement(
    params: EnsureCheckInStreakRewardSettlementParams,
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
    const requestPayload: GrowthRewardSettlementCheckInStreakRewardPayloadDto =
      {
        kind: 'check_in_streak_reward',
        grantId: params.grantId,
        userId: params.userId,
        ruleId: params.ruleId,
        ruleCode: params.ruleCode,
        triggerSignDate: params.triggerSignDate,
        rewardItems: params.rewardItems ?? null,
      }

    return this.ensureManualSettlement(
      {
        userId: params.userId,
        bizKey,
        settlementType: GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD,
        source: GrowthLedgerSourceEnum.CHECK_IN_STREAK_BONUS,
        sourceRecordId: params.grantId,
        eventOccurredAt: new Date(`${params.triggerSignDate}T00:00:00.000Z`),
        requestPayload,
      },
      tx,
    )
  }

  // 同步任务/签到补偿链路的最终处理结果，并维护补偿重试元数据。
  async syncManualSettlementResult(
    settlementId: number,
    result: SyncManualSettlementResultInput,
    options?: SyncManualSettlementResultOptions,
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
        settlementResultType: result.resultType,
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

  // 以 userId + bizKey 为唯一键补建人工补偿事实，不重复创建第二条记录。
  private async ensureManualSettlement(
    params: EnsureManualSettlementParams,
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

  // upsert 通用成长事件补偿事实，保证后续重试链路能拿到稳定快照。
  private async upsertGrowthEventSettlement(
    input: DispatchDefinedGrowthEventPayload,
    payload: UpsertGrowthEventSettlementPayload,
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

  // 按主键更新补偿状态字段，供 bridge、retry 和人工补偿链路复用。
  async updateSettlementState(
    id: number,
    payload: UpdateSettlementStatePayload,
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

  // 根据失败原因判断当前补偿记录应保持待重试还是直接落为终态失败。
  private resolveFailureStatus(growthResult: GrowthRuleRewardSettlementResult) {
    if (
      growthResult.failureReason &&
      NON_RETRYABLE_FAILURE_REASONS.has(growthResult.failureReason)
    ) {
      return GrowthRewardSettlementStatusEnum.TERMINAL
    }

    const results = growthResult.rewardResults
      .map((item) => item.result)
      .filter((item): item is NonNullable<typeof item> => item !== undefined)

    if (
      results.length > 0 &&
      results.every(
        (item) =>
          !item.success &&
          item.duplicated !== true &&
          item.reason !== undefined &&
          NON_RETRYABLE_FAILURE_REASONS.has(item.reason),
      )
    ) {
      return GrowthRewardSettlementStatusEnum.TERMINAL
    }

    return GrowthRewardSettlementStatusEnum.PENDING
  }

  // 把规则奖励幂等结果映射成补偿记录的结果类型。
  private resolveSuccessResultType(
    growthResult: GrowthRuleRewardSettlementResult,
  ) {
    if (growthResult.dedupeResult === GrowthRewardDedupeResultEnum.IDEMPOTENT) {
      return GrowthRewardSettlementResultTypeEnum.IDEMPOTENT
    }
    return GrowthRewardSettlementResultTypeEnum.APPLIED
  }

  // 序列化通用成长事件补偿重放所需的最小稳定快照。
  private serializePayload(input: DispatchDefinedGrowthEventPayload) {
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
