import type {
  CheckInActivityStreakInsert,
  CheckInActivityStreakProgressInsert,
  CheckInDailyStreakConfigInsert,
  CheckInDailyStreakProgressInsert,
  CheckInMakeupAccountInsert,
  CheckInMakeupFactInsert,
  CheckInRecordInsert,
  CheckInStreakGrantInsert,
} from '@db/schema'
import type { GrowthRewardItems } from '../reward-rule/reward-item.type'

import type {
  CheckInActivityStreakStatusEnum,
  CheckInDailyStreakConfigStatusEnum,
  CheckInDailyStreakPublishStrategyEnum,
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
  CheckInStreakScopeTypeEnum,
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

/** 日常连续签到配置定义。 */
export interface CheckInDailyStreakConfigDefinition {
  version: number
  status: CheckInDailyStreakConfigStatusEnum
  publishStrategy: CheckInDailyStreakPublishStrategyEnum
  rewardRules: CheckInStreakRewardRuleView[]
  effectiveFrom: Date
  effectiveTo: Date | null
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

/** 日常连续签到进度读模型。 */
export interface CheckInDailyStreakProgressView {
  currentStreak: number
  streakStartedAt?: string
  lastSignedDate?: string
  nextReward?: CheckInStreakRewardRuleView | null
}

/** 活动连续签到定义。 */
export interface CheckInActivityStreakDefinition {
  activityKey: string
  title: string
  status: CheckInActivityStreakStatusEnum
  effectiveFrom: Date
  effectiveTo: Date
  rewardRules: CheckInStreakRewardRuleView[]
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
  CheckInStreakGrantInsert,
  | 'userId'
  | 'scopeType'
  | 'configVersionId'
  | 'activityId'
  | 'triggerSignDate'
  | 'rewardSettlementId'
  | 'bizKey'
  | 'ruleCode'
  | 'streakDays'
  | 'rewardItems'
  | 'repeatable'
  | 'context'
>

/** 日常连续签到配置写入入参。 */
export type CreateCheckInDailyStreakConfigInput = Pick<
  CheckInDailyStreakConfigInsert,
  | 'version'
  | 'status'
  | 'publishStrategy'
  | 'rewardRules'
  | 'effectiveFrom'
  | 'effectiveTo'
  | 'updatedById'
>

/** 日常连续签到进度写入入参。 */
export type CreateCheckInDailyStreakProgressInput = Pick<
  CheckInDailyStreakProgressInsert,
  'userId' | 'currentStreak' | 'streakStartedAt' | 'lastSignedDate' | 'version'
>

/** 活动连续签到定义写入入参。 */
export type CreateCheckInActivityStreakInput = Pick<
  CheckInActivityStreakInsert,
  | 'activityKey'
  | 'title'
  | 'status'
  | 'effectiveFrom'
  | 'effectiveTo'
  | 'rewardRules'
  | 'updatedById'
>

/** 活动连续签到进度写入入参。 */
export type CreateCheckInActivityStreakProgressInput = Pick<
  CheckInActivityStreakProgressInsert,
  | 'activityId'
  | 'userId'
  | 'currentStreak'
  | 'streakStartedAt'
  | 'lastSignedDate'
  | 'version'
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

/** 连续奖励发放作用域快照。 */
export interface CheckInGrantScopeSnapshot {
  scopeType: CheckInStreakScopeTypeEnum
  configVersionId: number | null
  activityId: number | null
}

/** 重算连续签到聚合结果。 */
export interface CheckInStreakAggregation {
  currentStreak: number
  streakStartedAt?: string
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
