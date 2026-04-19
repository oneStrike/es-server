import type {
  CheckInMakeupAccountInsert,
  CheckInMakeupFactInsert,
  CheckInRecordInsert,
  CheckInStreakProgressInsert,
  CheckInStreakRewardGrantInsert,
  CheckInStreakRoundConfigInsert,
} from '@db/schema'
import type { GrowthRewardItems } from '../reward-rule/reward-item.type'

import type {
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakNextRoundStrategyEnum,
  CheckInStreakRewardRuleStatusEnum,
  CheckInStreakRoundStatusEnum,
} from './check-in.constant'

/** 稳定领域类型 `CheckInRewardItems`。 */
export type CheckInRewardItems = GrowthRewardItems

/** 具体日期奖励规则。 */
export interface CheckInDateRewardRuleView {
  rewardDate: string
  rewardItems: CheckInRewardItems
}

/** 周期模式奖励规则。 */
export interface CheckInPatternRewardRuleView {
  patternType: CheckInPatternRewardRuleTypeEnum
  weekday: number | null
  monthDay: number | null
  rewardItems: CheckInRewardItems
}

/** 连续奖励规则。 */
export interface CheckInStreakRewardRuleView {
  ruleCode: string
  streakDays: number
  rewardItems: CheckInRewardItems
  repeatable: boolean
  status: CheckInStreakRewardRuleStatusEnum
}

/** 全局签到奖励定义。 */
export interface CheckInRewardDefinition {
  baseRewardItems: CheckInRewardItems | null
  dateRewardRules: CheckInDateRewardRuleView[]
  patternRewardRules: CheckInPatternRewardRuleView[]
}

/** 连续奖励轮次定义。 */
export interface CheckInStreakRoundDefinition {
  roundCode: string
  version: number
  status: CheckInStreakRoundStatusEnum
  rewardRules: CheckInStreakRewardRuleView[]
  nextRoundStrategy: CheckInStreakNextRoundStrategyEnum
  nextRoundConfigId: number | null
}

/** 当前补签周期窗口。 */
export interface CheckInMakeupWindowView {
  periodType: CheckInMakeupPeriodTypeEnum
  periodKey: string
  periodStartDate: string
  periodEndDate: string
}

/** 当前补签账户读模型。 */
export interface CheckInMakeupAccountView extends CheckInMakeupWindowView {
  periodicGranted: number
  periodicUsed: number
  periodicRemaining: number
  eventAvailable: number
}

/** 当前连续奖励进度读模型。 */
export interface CheckInStreakProgressView {
  roundConfigId: number
  roundCode: string
  roundIteration: number
  currentStreak: number
  roundStartedAt?: string
  lastSignedDate?: string
}

/** 补签事实写入入参。 */
export type CreateCheckInMakeupFactInput = Pick<
  CheckInMakeupFactInsert,
  | 'userId'
  | 'factType'
  | 'sourceType'
  | 'amount'
  | 'consumedAmount'
  | 'effectiveAt'
  | 'expiresAt'
  | 'periodType'
  | 'periodKey'
  | 'sourceRef'
  | 'bizKey'
  | 'context'
>

/** 补签账户写入入参。 */
export type CreateCheckInMakeupAccountInput = Pick<
  CheckInMakeupAccountInsert,
  | 'userId'
  | 'periodType'
  | 'periodKey'
  | 'periodicGranted'
  | 'periodicUsed'
  | 'eventAvailable'
  | 'version'
  | 'lastSyncedFactId'
>

/** 签到事实写入入参。 */
export type CreateCheckInRecordInput = Pick<
  CheckInRecordInsert,
  | 'userId'
  | 'signDate'
  | 'recordType'
  | 'resolvedRewardSourceType'
  | 'resolvedRewardRuleKey'
  | 'resolvedRewardItems'
  | 'rewardSettlementId'
  | 'bizKey'
  | 'operatorType'
  | 'context'
>

/** 连续奖励事实写入入参。 */
export type CreateCheckInGrantInput = Pick<
  CheckInStreakRewardGrantInsert,
  | 'userId'
  | 'roundConfigId'
  | 'roundIteration'
  | 'triggerSignDate'
  | 'rewardSettlementId'
  | 'bizKey'
  | 'ruleCode'
  | 'streakDays'
  | 'rewardItems'
  | 'repeatable'
  | 'context'
>

/** 连续奖励进度写入入参。 */
export type CreateCheckInStreakProgressInput = Pick<
  CheckInStreakProgressInsert,
  | 'userId'
  | 'roundConfigId'
  | 'roundIteration'
  | 'currentStreak'
  | 'roundStartedAt'
  | 'lastSignedDate'
  | 'version'
>

/** 连续奖励轮次配置写入入参。 */
export type CreateCheckInStreakRoundConfigInput = Pick<
  CheckInStreakRoundConfigInsert,
  | 'roundCode'
  | 'version'
  | 'status'
  | 'rewardRules'
  | 'nextRoundStrategy'
  | 'nextRoundConfigId'
  | 'updatedById'
>

/** 当前签到日命中的基础奖励解析结果。 */
export interface CheckInResolvedReward {
  resolvedRewardSourceType: CheckInRewardSourceTypeEnum | null
  resolvedRewardRuleKey: string | null
  resolvedRewardItems: CheckInRewardItems | null
}

/** 连续奖励发放事实中的规则快照。 */
export interface CheckInGrantRuleSnapshot {
  ruleCode: string
  streakDays: number
  rewardItems: CheckInRewardItems
  repeatable: boolean
}

/** 重算连续签到聚合结果。 */
export interface CheckInStreakAggregation {
  currentStreak: number
  lastSignedDate?: string
  streakByDate: Record<string, number>
}

/** 补签可消费额度结果。 */
export interface CheckInAvailableMakeupBalance {
  periodicRemaining: number
  eventAvailable: number
}

/** 补签消费来源。 */
export interface CheckInMakeupConsumePlanItem {
  sourceType: CheckInMakeupSourceTypeEnum
  amount: number
}
