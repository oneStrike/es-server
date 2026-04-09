import type {
  CheckInCycleInsert,
  CheckInDailyRewardRule,
  CheckInDailyRewardRuleInsert,
  CheckInPlan,
  CheckInRecordInsert,
  CheckInStreakRewardGrant,
  CheckInStreakRewardGrantInsert,
  CheckInStreakRewardRule,
  CheckInStreakRewardRuleInsert,
} from '@db/schema'
import type {
  CheckInCycleTypeEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'

/**
 * 签到奖励配置。
 *
 * 当前只支持积分与经验两类资产，字段值统一要求为正整数。
 */
export interface CheckInRewardConfig {
  points?: number
  experience?: number
}

/**
 * 从计划表构建快照时所需字段来源。
 */
export type CheckInPlanSnapshotSource = Pick<
  CheckInPlan,
  | 'id'
  | 'planCode'
  | 'planName'
  | 'cycleType'
  | 'startDate'
  | 'endDate'
  | 'allowMakeupCountPerCycle'
  | 'baseRewardConfig'
  | 'version'
>

/**
 * 按日奖励规则稳定公共字段。
 *
 * 供管理端详情、周期快照和执行链路共享相同的奖励解释结构。
 */
export interface CheckInDailyRewardRuleCoreView {
  id: number
  dayIndex: number
  rewardConfig: CheckInRewardConfig
}

/**
 * 周期快照中的按日奖励规则。
 *
 * 冻结到周期快照中，保证奖励补偿与历史对账都使用签到当时的解释结果。
 */
export interface CheckInPlanSnapshotDailyRewardRule
  extends CheckInDailyRewardRuleCoreView {
  planVersion: number
}

/**
 * 连续奖励规则稳定公共字段。
 *
 * 供周期快照、前台下一档奖励和后台规则详情共享同一组核心语义。
 */
export interface CheckInStreakRewardRuleCoreView {
  id: number
  ruleCode: string
  streakDays: number
  rewardConfig: CheckInRewardConfig
  repeatable: boolean
  status: CheckInStreakRewardRuleStatusEnum
}

/**
 * 连续奖励规则快照。
 *
 * 冻结到周期快照中，保证用户在当前周期内继续按旧规则解释。
 */
export interface CheckInPlanSnapshotRule extends CheckInStreakRewardRuleCoreView {
  planVersion: number
}

/**
 * 周期快照。
 *
 * 除基础计划字段外，也要冻结当前版本下的连续奖励规则集合。
 */
export interface CheckInPlanSnapshot
  extends Omit<CheckInPlanSnapshotSource, 'cycleType'> {
  cycleType: CheckInCycleTypeEnum
  baseRewardConfig: CheckInRewardConfig | null
  dailyRewardRules: CheckInPlanSnapshotDailyRewardRule[]
  streakRewardRules: CheckInPlanSnapshotRule[]
}

/**
 * 签到计划在运行态摘要中暴露的稳定字段。
 *
 * 该视图只保留 App 摘要真正需要的计划信息，不把周期快照的全部字段抬升出来。
 */
export type CheckInPlanSummaryView = Pick<
  CheckInPlanSnapshot,
  | 'id'
  | 'planCode'
  | 'planName'
  | 'cycleType'
  | 'startDate'
  | 'endDate'
  | 'allowMakeupCountPerCycle'
  | 'baseRewardConfig'
> &
Pick<CheckInPlan, 'status'>

/**
 * 周期窗口字段。
 *
 * 供周期边界计算、摘要和日历视图复用相同的日期区间结构。
 */
export interface CheckInCycleWindowView {
  cycleKey: string
  cycleStartDate: string
  cycleEndDate: string
}

/**
 * 周期聚合进度字段。
 *
 * 表达当前周期在签到事实重算后的进度摘要。
 */
export interface CheckInCycleProgressView {
  signedCount: number
  makeupUsedCount: number
  currentStreak: number
  lastSignedDate?: string
}

/**
 * App 摘要使用的周期视图。
 *
 * 在通用周期窗口和聚合字段基础上，只额外补充剩余补签次数。
 */
export interface CheckInSummaryCycleView
  extends CheckInCycleWindowView, CheckInCycleProgressView {
  id?: number
  remainingMakeupCount: number
}

/**
 * 周期边界计算结果。
 */
export interface CheckInCycleFrame {
  cycleKey: string
  cycleStartDate: string
  cycleEndDate: string
}

/**
 * 周期聚合重算结果。
 */
export interface CheckInCycleAggregation {
  signedCount: number
  makeupUsedCount: number
  currentStreak: number
  lastSignedDate?: string
  streakByDate: Record<string, number>
}

/**
 * 周期创建入参。
 */
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
  | 'planSnapshotVersion'
  | 'planSnapshot'
>

/**
 * 记录写入入参。
 */
export type CreateCheckInRecordInput = Pick<
  CheckInRecordInsert,
  | 'userId'
  | 'planId'
  | 'cycleId'
  | 'signDate'
  | 'recordType'
  | 'rewardStatus'
  | 'rewardDayIndex'
  | 'resolvedRewardConfig'
  | 'bizKey'
  | 'operatorType'
  | 'context'
>

/**
 * 发放事实写入入参。
 */
export type CreateCheckInGrantInput = Pick<
  CheckInStreakRewardGrantInsert,
  | 'userId'
  | 'planId'
  | 'cycleId'
  | 'ruleId'
  | 'triggerSignDate'
  | 'grantStatus'
  | 'bizKey'
  | 'planSnapshotVersion'
  | 'context'
>

/**
 * 连续奖励规则写入来源。
 */
export type CreateCheckInStreakRewardRuleInsert = Pick<
  CheckInStreakRewardRuleInsert,
  | 'planId'
  | 'planVersion'
  | 'ruleCode'
  | 'streakDays'
  | 'rewardConfig'
  | 'repeatable'
  | 'status'
>

/**
 * 按日奖励规则写入来源。
 */
export type CreateCheckInDailyRewardRuleInsert = Pick<
  CheckInDailyRewardRuleInsert,
  | 'planId'
  | 'planVersion'
  | 'dayIndex'
  | 'rewardConfig'
>

/**
 * 按日奖励规则与计划的拼接行。
 */
export interface CheckInDailyRewardRuleRow {
  rule: CheckInDailyRewardRule
}

/**
 * 发放事实与规则的拼接行。
 */
export interface CheckInGrantWithRuleRow {
  grant: CheckInStreakRewardGrant
  rule?: CheckInStreakRewardRule | null
}

/**
 * 周期读视图所需的计划来源。
 */
export interface CheckInVirtualCycleView
  extends CheckInCycleWindowView, CheckInCycleProgressView {
  id?: number
  planSnapshotVersion: number
  planSnapshot: CheckInPlanSnapshot
}
