import type { Db } from '@db/core'
import type { GrowthRewardSettlementSelect } from '@db/schema'
import type { CheckInRewardResultTypeEnum } from '../../check-in/check-in.constant'
import type { GrowthLedgerSourceEnum } from '../../growth-ledger/growth-ledger.constant'
import type { GrowthRewardItems } from '../../reward-rule/reward-item.type'
import type {
  GrowthRewardSettlementCheckInRecordRewardPayloadDto,
  GrowthRewardSettlementCheckInStreakRewardPayloadDto,
  GrowthRewardSettlementTaskRewardPayloadDto,
} from '../dto/growth-reward-settlement.dto'
import type {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementTypeEnum,
} from '../growth-reward.constant'

/** 手工补偿链路允许写入的补偿载荷。 */
export type ManualGrowthRewardSettlementPayload =
  | GrowthRewardSettlementTaskRewardPayloadDto
  | GrowthRewardSettlementCheckInRecordRewardPayloadDto
  | GrowthRewardSettlementCheckInStreakRewardPayloadDto

/** 手工补偿链路允许接收的结果类型。 */
export type ManualGrowthRewardSettlementResultType =
  | GrowthRewardSettlementResultTypeEnum
  | CheckInRewardResultTypeEnum

/** 签到基础奖励补偿事实创建入参。 */
export interface EnsureCheckInRecordRewardSettlementParams {
  recordId: number
  userId: number
  configId: number
  signDate: string
  rewardItems?: GrowthRewardItems | null
}

/** 连续签到奖励补偿事实创建入参。 */
export interface EnsureCheckInStreakRewardSettlementParams {
  grantId: number
  userId: number
  ruleId: number
  ruleCode: string
  triggerSignDate: string
  rewardItems?: GrowthRewardItems | null
}

/** 手工补偿结果同步入参。 */
export interface SyncManualSettlementResultInput {
  success: boolean
  resultType: ManualGrowthRewardSettlementResultType
  ledgerRecordIds: GrowthRewardSettlementSelect['ledgerRecordIds']
  errorMessage?: string | null
}

/** 手工补偿结果同步选项。 */
export interface SyncManualSettlementResultOptions {
  isRetry?: boolean
  tx?: Db
}

/** 手工补偿事实补建入参。 */
export interface EnsureManualSettlementParams {
  userId: GrowthRewardSettlementSelect['userId']
  bizKey: GrowthRewardSettlementSelect['bizKey']
  settlementType: GrowthRewardSettlementTypeEnum
  source: GrowthLedgerSourceEnum
  sourceRecordId: NonNullable<GrowthRewardSettlementSelect['sourceRecordId']>
  eventOccurredAt: GrowthRewardSettlementSelect['eventOccurredAt']
  requestPayload: ManualGrowthRewardSettlementPayload
}

/** 补偿状态更新载荷。 */
export type UpdateSettlementStatePayload = Pick<
  GrowthRewardSettlementSelect,
  | 'settlementResultType'
  | 'ledgerRecordIds'
  | 'settlementStatus'
  | 'retryCount'
  | 'lastRetryAt'
  | 'settledAt'
  | 'lastError'
>

/** 通用成长事件补偿事实写入载荷。 */
export type UpsertGrowthEventSettlementPayload = Pick<
  UpdateSettlementStatePayload,
  'settlementStatus' | 'settlementResultType' | 'ledgerRecordIds' | 'lastError'
>

/** 任务奖励补偿快照里的最小主键视图。 */
export type StoredTaskRewardPayloadIdentity = Pick<
  GrowthRewardSettlementTaskRewardPayloadDto,
  'instanceId' | 'taskId' | 'userId'
>

/** 签到基础奖励补偿快照里的最小主键视图。 */
export type StoredCheckInRecordRewardPayloadIdentity = Pick<
  GrowthRewardSettlementCheckInRecordRewardPayloadDto,
  'recordId'
>

/** 连续签到奖励补偿快照里的最小主键视图。 */
export type StoredCheckInStreakRewardPayloadIdentity = Pick<
  GrowthRewardSettlementCheckInStreakRewardPayloadDto,
  'grantId'
>
