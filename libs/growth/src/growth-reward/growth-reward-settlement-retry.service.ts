import type {
  StoredCheckInRecordRewardPayloadIdentity,
  StoredCheckInStreakRewardPayloadIdentity,
  StoredTaskRewardPayloadIdentity,
  UpdateSettlementStatePayload,
} from './types/growth-reward-settlement.type'
import type { DispatchDefinedGrowthEventPayload } from './types/growth-event-dispatch.type'
import type {
  GrowthRewardApplyResultList,
  GrowthRuleRewardSettlementResult,
} from './types/growth-reward-result.type'
import { CheckInRepairTargetTypeEnum } from '@libs/growth/check-in/check-in.constant'
import { CheckInService } from '@libs/growth/check-in/check-in.service'
import { TaskService } from '@libs/growth/task/task.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { GrowthLedgerFailReasonEnum } from '../growth-ledger/growth-ledger.constant'
import { GrowthEventDispatchService } from './growth-event-dispatch.service'
import { GrowthRewardSettlementService } from './growth-reward-settlement.service'
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
 * 通用成长奖励补偿重试编排服务。
 *
 * 仅负责 admin/manual retry 与跨域重放，不承载 settlement 事实存储。
 */
@Injectable()
export class GrowthRewardSettlementRetryService {
  constructor(
    private readonly growthRewardSettlementStore: GrowthRewardSettlementService,
    private readonly growthEventDispatchService: GrowthEventDispatchService,
    private readonly taskService: TaskService,
    private readonly checkInService: CheckInService,
  ) {}

  // 手动重试单条待补偿记录，并把本次处理结果同步回补偿事实。
  async retrySettlement(id: number, adminUserId?: number) {
    const record = await this.growthRewardSettlementStore.getSettlementById(id)

    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '成长奖励补偿记录不存在',
      )
    }

    if (record.settlementStatus === GrowthRewardSettlementStatusEnum.SUCCESS) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '成长奖励已补偿成功，无需重试',
      )
    }
    if (record.settlementStatus === GrowthRewardSettlementStatusEnum.TERMINAL) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '成长奖励已进入终态失败，无需重试',
      )
    }

    const nextRetryCount = record.retryCount + 1
    const lastRetryAt = new Date()

    try {
      if (
        record.settlementType === GrowthRewardSettlementTypeEnum.TASK_REWARD
      ) {
        const taskPayload = this.parseStoredTaskPayload(record.requestPayload)
        await this.taskService.retryTaskAssignmentReward(
          taskPayload.assignmentId,
          true,
        )
        const latest = await this.growthRewardSettlementStore.getSettlementById(
          record.id,
        )
        return (
          latest?.settlementStatus === GrowthRewardSettlementStatusEnum.SUCCESS
        )
      }

      if (
        record.settlementType ===
        GrowthRewardSettlementTypeEnum.CHECK_IN_RECORD_REWARD
      ) {
        const checkInRecordPayload = this.parseStoredCheckInRecordPayload(
          record.requestPayload,
        )
        await this.checkInService.repairReward(
          {
            targetType: CheckInRepairTargetTypeEnum.RECORD_REWARD,
            recordId: checkInRecordPayload.recordId,
          },
          adminUserId ?? 0,
        )
        const latest = await this.growthRewardSettlementStore.getSettlementById(
          record.id,
        )
        return (
          latest?.settlementStatus === GrowthRewardSettlementStatusEnum.SUCCESS
        )
      }

      if (
        record.settlementType ===
        GrowthRewardSettlementTypeEnum.CHECK_IN_STREAK_REWARD
      ) {
        const checkInGrantPayload = this.parseStoredCheckInGrantPayload(
          record.requestPayload,
        )
        await this.checkInService.repairReward(
          {
            targetType: CheckInRepairTargetTypeEnum.STREAK_GRANT,
            grantId: checkInGrantPayload.grantId,
          },
          adminUserId ?? 0,
        )
        const latest = await this.growthRewardSettlementStore.getSettlementById(
          record.id,
        )
        return (
          latest?.settlementStatus === GrowthRewardSettlementStatusEnum.SUCCESS
        )
      }

      const payload = this.parseStoredGrowthEventPayload(record.requestPayload)
      const dispatchResult =
        await this.growthEventDispatchService.dispatchDefinedEvent(payload)

      if (
        dispatchResult.growthHandled &&
        dispatchResult.growthResult?.success
      ) {
        const payload: UpdateSettlementStatePayload = {
          settlementStatus: GrowthRewardSettlementStatusEnum.SUCCESS,
          settlementResultType: this.resolveSuccessResultType(
            dispatchResult.growthResult,
          ),
          ledgerRecordIds: dispatchResult.growthResult.ledgerRecordIds,
          retryCount: nextRetryCount,
          lastRetryAt,
          settledAt: new Date(),
          lastError: null,
        }
        await this.growthRewardSettlementStore.updateSettlementState(
          record.id,
          payload,
        )
        return true
      }

      const growthResult = dispatchResult.growthResult
      const failedPayload: UpdateSettlementStatePayload = {
        settlementStatus: growthResult
          ? this.resolveFailureStatus(growthResult)
          : GrowthRewardSettlementStatusEnum.PENDING,
        settlementResultType: GrowthRewardSettlementResultTypeEnum.FAILED,
        ledgerRecordIds:
          growthResult?.ledgerRecordIds ?? record.ledgerRecordIds,
        retryCount: nextRetryCount,
        lastRetryAt,
        settledAt: null,
        lastError: growthResult?.errorMessage ?? '成长奖励补偿未成功',
      }
      await this.growthRewardSettlementStore.updateSettlementState(
        record.id,
        failedPayload,
      )
      return false
    } catch (error) {
      const exceptionPayload: UpdateSettlementStatePayload = {
        settlementStatus: this.resolveRetryExceptionStatus(error),
        settlementResultType: GrowthRewardSettlementResultTypeEnum.FAILED,
        ledgerRecordIds: record.ledgerRecordIds,
        retryCount: nextRetryCount,
        lastRetryAt,
        settledAt: null,
        lastError: error instanceof Error ? error.message : String(error),
      }
      await this.growthRewardSettlementStore.updateSettlementState(
        record.id,
        exceptionPayload,
      )
      return false
    }
  }

  // 批量扫描并重试待补偿记录，返回本轮扫描与成功统计。
  async retryPendingSettlementsBatch(limit = 100, adminUserId?: number) {
    const records =
      await this.growthRewardSettlementStore.listPendingSettlementIds(
        Math.max(1, Math.min(limit, 500)),
      )

    let succeededCount = 0
    for (const record of records) {
      if (await this.retrySettlement(record.id, adminUserId)) {
        succeededCount += 1
      }
    }

    return {
      scannedCount: records.length,
      succeededCount,
      failedCount: records.length - succeededCount,
    }
  }

  // 根据失败原因判断重试后的补偿记录应保持待处理还是直接转终态。
  private resolveFailureStatus(growthResult: GrowthRuleRewardSettlementResult) {
    if (this.isNonRetryableFailureReason(growthResult.failureReason)) {
      return GrowthRewardSettlementStatusEnum.TERMINAL
    }

    const results = growthResult.rewardResults
      .map((item) => item.result)
      .filter(
        (item): item is NonNullable<GrowthRewardApplyResultList[number]> =>
          item !== undefined,
      )

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

  // 判断失败原因是否明确属于不可重试的规则拒绝。
  private isNonRetryableFailureReason(reason?: GrowthLedgerFailReasonEnum) {
    return reason !== undefined && NON_RETRYABLE_FAILURE_REASONS.has(reason)
  }

  // 把规则奖励幂等结果映射成补偿结果类型。
  private resolveSuccessResultType(
    growthResult: GrowthRuleRewardSettlementResult,
  ) {
    if (growthResult.dedupeResult === GrowthRewardDedupeResultEnum.IDEMPOTENT) {
      return GrowthRewardSettlementResultTypeEnum.IDEMPOTENT
    }
    return GrowthRewardSettlementResultTypeEnum.APPLIED
  }

  // 仅把确定无法通过再次重试恢复的异常视为终态失败。
  private resolveRetryExceptionStatus(error: unknown) {
    if (
      error instanceof BusinessException &&
      (error.code === BusinessErrorCode.STATE_CONFLICT ||
        error.code === BusinessErrorCode.RESOURCE_NOT_FOUND)
    ) {
      return GrowthRewardSettlementStatusEnum.TERMINAL
    }

    return GrowthRewardSettlementStatusEnum.PENDING
  }

  // 解析任务奖励补偿快照，并校验重试所需的最小主键字段。
  private parseStoredTaskPayload(
    payload: unknown,
  ): StoredTaskRewardPayloadIdentity {
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null
    const assignmentId = Number(record?.assignmentId)
    const taskId = Number(record?.taskId)
    const userId = Number(record?.userId)
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务奖励补偿记录载荷损坏，assignmentId 缺失',
      )
    }
    if (
      !Number.isInteger(taskId) ||
      taskId <= 0 ||
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '任务奖励补偿记录载荷损坏，taskId 或 userId 缺失',
      )
    }
    return {
      assignmentId,
      taskId,
      userId,
    }
  }

  // 解析签到基础奖励补偿快照，并校验 recordId。
  private parseStoredCheckInRecordPayload(
    payload: unknown,
  ): StoredCheckInRecordRewardPayloadIdentity {
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null
    const recordId = Number(record?.recordId)
    if (!Number.isInteger(recordId) || recordId <= 0) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '签到基础奖励补偿记录载荷损坏，recordId 缺失',
      )
    }
    return { recordId }
  }

  // 解析连续签到奖励补偿快照，并校验 grantId。
  private parseStoredCheckInGrantPayload(
    payload: unknown,
  ): StoredCheckInStreakRewardPayloadIdentity {
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null
    const grantId = Number(record?.grantId)
    if (!Number.isInteger(grantId) || grantId <= 0) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '签到连续奖励补偿记录载荷损坏，grantId 缺失',
      )
    }
    return { grantId }
  }

  // 解析通用成长事件补偿快照，并恢复 dispatch 层可消费的事件入参。
  private parseStoredGrowthEventPayload(
    payload: unknown,
  ): DispatchDefinedGrowthEventPayload {
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null
    const eventEnvelopeRecord =
      record?.eventEnvelope &&
      typeof record.eventEnvelope === 'object' &&
      !Array.isArray(record.eventEnvelope)
        ? (record.eventEnvelope as Record<string, unknown>)
        : null

    const code = Number(eventEnvelopeRecord?.code)
    const subjectId = Number(eventEnvelopeRecord?.subjectId)
    const targetId = Number(eventEnvelopeRecord?.targetId)
    const occurredAt = new Date(String(eventEnvelopeRecord?.occurredAt))

    if (
      !record ||
      !eventEnvelopeRecord ||
      !Number.isInteger(code) ||
      !Number.isInteger(subjectId) ||
      !Number.isInteger(targetId) ||
      Number.isNaN(occurredAt.getTime()) ||
      typeof record.bizKey !== 'string' ||
      record.bizKey.trim() === '' ||
      typeof record.source !== 'string' ||
      record.source.trim() === '' ||
      typeof eventEnvelopeRecord.key !== 'string' ||
      eventEnvelopeRecord.key.trim() === '' ||
      typeof eventEnvelopeRecord.subjectType !== 'string' ||
      eventEnvelopeRecord.subjectType.trim() === '' ||
      typeof eventEnvelopeRecord.targetType !== 'string' ||
      eventEnvelopeRecord.targetType.trim() === '' ||
      typeof eventEnvelopeRecord.governanceStatus !== 'string' ||
      eventEnvelopeRecord.governanceStatus.trim() === ''
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '成长奖励补偿记录载荷损坏，无法重试',
      )
    }

    const context =
      record.context &&
      typeof record.context === 'object' &&
      !Array.isArray(record.context)
        ? (record.context as Record<string, unknown>)
        : undefined
    const eventContext =
      eventEnvelopeRecord.context &&
      typeof eventEnvelopeRecord.context === 'object' &&
      !Array.isArray(eventEnvelopeRecord.context)
        ? (eventEnvelopeRecord.context as Record<string, unknown>)
        : undefined

    return {
      eventEnvelope: {
        code,
        key: eventEnvelopeRecord.key,
        subjectType: eventEnvelopeRecord.subjectType,
        subjectId,
        targetType: eventEnvelopeRecord.targetType,
        targetId,
        operatorId: Number.isInteger(eventEnvelopeRecord.operatorId)
          ? Number(eventEnvelopeRecord.operatorId)
          : undefined,
        occurredAt,
        governanceStatus: eventEnvelopeRecord.governanceStatus,
        context: eventContext,
      } as DispatchDefinedGrowthEventPayload['eventEnvelope'],
      bizKey: record.bizKey,
      source: record.source,
      remark:
        typeof record.remark === 'string' && record.remark.trim() !== ''
          ? record.remark
          : undefined,
      targetType: Number.isInteger(record.targetType)
        ? Number(record.targetType)
        : undefined,
      targetId: Number.isInteger(record.targetId)
        ? Number(record.targetId)
        : undefined,
      context,
    }
  }
}
