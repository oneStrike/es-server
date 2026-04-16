import type { CheckInCycleInsert, CheckInPlan, CheckInRecordInsert, CheckInStreakRewardGrantInsert } from '@db/schema'

import type {
  CheckInCycleTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'

/**
 * 签到奖励配置。
 *
 * 当前只支持积分与经验两类资产，字段值统一要求为正整数。
 */
/** 稳定领域类型 `CheckInRewardConfig`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface CheckInRewardConfig {
  points?: number
  experience?: number
}

/** 具体日期奖励规则。 */
export interface CheckInDateRewardRuleView {
  rewardDate: string
  rewardConfig: CheckInRewardConfig
}

/** 周期模式奖励规则。 */
export interface CheckInPatternRewardRuleView {
  patternType: CheckInPatternRewardRuleTypeEnum
  weekday: number | null
  monthDay: number | null
  rewardConfig: CheckInRewardConfig
}

/** 连续签到奖励规则。 */
export interface CheckInStreakRewardRuleView {
  ruleCode: string
  streakDays: number
  rewardConfig: CheckInRewardConfig
  repeatable: boolean
  status: CheckInStreakRewardRuleStatusEnum
}

/**
 * 单计划奖励定义。
 *
 * 当前计划只维护一份生效中的奖励定义；一旦产生签到事实，定义不再允许修改。
 */
/** 稳定领域类型 `CheckInRewardDefinition`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface CheckInRewardDefinition {
  baseRewardConfig: CheckInRewardConfig | null
  dateRewardRules: CheckInDateRewardRuleView[]
  patternRewardRules: CheckInPatternRewardRuleView[]
  streakRewardRules: CheckInStreakRewardRuleView[]
}

/** 当前周期窗口字段。 */
export interface CheckInCycleWindowView {
  cycleKey: string
  cycleStartDate: string
  cycleEndDate: string
}

/** 当前周期聚合进度字段。 */
export interface CheckInCycleProgressView {
  signedCount: number
  makeupUsedCount: number
  currentStreak: number
  lastSignedDate?: string
}

/** App 摘要使用的周期视图。 */
export interface CheckInSummaryCycleView
  extends CheckInCycleWindowView, CheckInCycleProgressView {
  id?: number
  remainingMakeupCount: number
}

/** 周期边界计算结果。 */
export interface CheckInCycleFrame {
  cycleKey: string
  cycleStartDate: string
  cycleEndDate: string
}

/** 周期聚合重算结果。 */
export interface CheckInCycleAggregation {
  signedCount: number
  makeupUsedCount: number
  currentStreak: number
  lastSignedDate?: string
  streakByDate: Record<string, number>
}

/** 周期创建入参。 */
export type CreateCheckInCycleInput = Pick<
  CheckInCycleInsert,
  | 'userId'
  | 'planId'
  | 'cycleKey'
  | 'cycleStartDate'
  | 'cycleEndDate'
  | 'signedCount'
  | 'makeupUsedCount'
  | 'currentStreak'
  | 'lastSignedDate'
>

/** 记录写入入参。 */
export type CreateCheckInRecordInput = Pick<
  CheckInRecordInsert,
  | 'userId'
  | 'planId'
  | 'cycleId'
  | 'signDate'
  | 'recordType'
  | 'rewardStatus'
  | 'resolvedRewardSourceType'
  | 'resolvedRewardRuleKey'
  | 'resolvedRewardConfig'
  | 'bizKey'
  | 'operatorType'
  | 'context'
>

/** 连续奖励事实写入入参。 */
export type CreateCheckInGrantInput = Pick<
  CheckInStreakRewardGrantInsert,
  | 'userId'
  | 'planId'
  | 'cycleId'
  | 'triggerSignDate'
  | 'grantStatus'
  | 'bizKey'
  | 'ruleCode'
  | 'streakDays'
  | 'rewardConfig'
  | 'repeatable'
  | 'context'
>

/** 当前签到日命中的基础奖励解析结果。 */
export interface CheckInResolvedReward {
  resolvedRewardSourceType: CheckInRewardSourceTypeEnum | null
  resolvedRewardRuleKey: string | null
  resolvedRewardConfig: CheckInRewardConfig | null
}

/** 当前周期读视图。 */
export interface CheckInVirtualCycleView
  extends CheckInCycleWindowView, CheckInCycleProgressView {
  id?: number
  rewardDefinition: CheckInRewardDefinition
}

/** 发放事实中冻结的连续奖励规则快照。 */
export interface CheckInGrantRuleSnapshot {
  ruleCode: string
  streakDays: number
  rewardConfig: CheckInRewardConfig
  repeatable: boolean
}

/** 计划在摘要中暴露的稳定字段。 */
export type CheckInPlanSummaryView = Pick<
  CheckInPlan,
  | 'id'
  | 'planCode'
  | 'planName'
  | 'status'
  | 'startDate'
  | 'endDate'
  | 'allowMakeupCountPerCycle'
> & {
  cycleType: CheckInCycleTypeEnum
  baseRewardConfig: CheckInRewardConfig | null
}
