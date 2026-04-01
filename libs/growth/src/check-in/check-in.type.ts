import type {
  CheckInCycleInsert,
  CheckInPlan,
  CheckInPlanInsert,
  CheckInRecordInsert,
  CheckInStreakRewardGrant,
  CheckInStreakRewardGrantInsert,
  CheckInStreakRewardRule,
  CheckInStreakRewardRuleInsert,
} from '@db/schema'
import type {
  PageQueryInput,
  PageQueryNoOrderInput,
  QueryOrderByInput,
} from '@libs/platform/types'
import type {
  CheckInCycleTypeEnum,
  CheckInPlanStatusEnum,
  CheckInRecordTypeEnum,
  CheckInRepairTargetTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from './check-in.constant'

/**
 * 签到分页排序入参。
 */
export type CheckInQueryOrderByInput = QueryOrderByInput

/**
 * `date` 语义字段统一使用 `YYYY-MM-DD` 字符串承载。
 */
export type CheckInDateOnly = string

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
  | 'cycleAnchorDate'
  | 'allowMakeupCountPerCycle'
  | 'baseRewardConfig'
  | 'version'
>

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
  extends Omit<CheckInPlanSnapshotSource, 'baseRewardConfig'> {
  baseRewardConfig?: CheckInRewardConfig | null
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
  | 'cycleAnchorDate'
  | 'allowMakeupCountPerCycle'
  | 'baseRewardConfig'
> & Pick<CheckInPlan, 'status' | 'publishStartAt' | 'publishEndAt'>

/**
 * 签到记录共享的奖励状态字段。
 *
 * 基础奖励相关读模型统一使用这组字段，避免动作返回、记录页和对账页各写一份。
 */
export interface CheckInRecordRewardStateView {
  rewardStatus?: CheckInRewardStatusEnum | null
  rewardResultType?: CheckInRewardResultTypeEnum | null
}

/**
 * 周期窗口字段。
 *
 * 供周期边界计算、摘要和日历视图复用相同的日期区间结构。
 */
export interface CheckInCycleWindowView {
  cycleKey: string
  cycleStartDate: CheckInDateOnly
  cycleEndDate: CheckInDateOnly
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
  lastSignedDate?: CheckInDateOnly
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

type CreateCheckInPlanInsertFields = Pick<
  CheckInPlanInsert,
  | 'planCode'
  | 'planName'
  | 'status'
  | 'isEnabled'
  | 'cycleType'
  | 'cycleAnchorDate'
  | 'allowMakeupCountPerCycle'
  | 'baseRewardConfig'
  | 'publishStartAt'
  | 'publishEndAt'
>

/**
 * 管理端连续奖励规则写入入参。
 */
export interface CheckInStreakRewardRuleInput {
  ruleCode: string
  streakDays: number
  rewardConfig: CheckInRewardConfig | Record<string, unknown>
  repeatable?: boolean
  status?: CheckInStreakRewardRuleStatusEnum
}

/**
 * 管理端签到计划创建入参。
 */
export interface CreateCheckInPlanInput extends CreateCheckInPlanInsertFields {
  status: CheckInPlanStatusEnum
  cycleType: CheckInCycleTypeEnum
  baseRewardConfig?: CheckInRewardConfig | Record<string, unknown> | null
  streakRewardRules?: CheckInStreakRewardRuleInput[]
}

/**
 * 管理端签到计划更新入参。
 */
export interface UpdateCheckInPlanInput extends Partial<CreateCheckInPlanInput> {
  id: number
}

/**
 * 管理端签到计划状态更新入参。
 */
export interface UpdateCheckInPlanStatusInput {
  id: number
  status?: CheckInPlanStatusEnum
  isEnabled?: boolean
}

/**
 * 管理端发布签到计划入参。
 */
export interface PublishCheckInPlanInput {
  id: number
}

/**
 * 管理端签到计划分页查询条件。
 */
export interface QueryCheckInPlanPageInput extends PageQueryNoOrderInput {
  planCode?: string
  planName?: string
  status?: CheckInPlanStatusEnum
  isEnabled?: boolean
  orderBy?: string
}

/**
 * App 端签到记录分页查询条件。
 */
export interface QueryMyCheckInRecordPageInput extends PageQueryInput {
  startDate?: string
  endDate?: string
  orderBy?: string
}

/**
 * 管理端签到对账分页查询条件。
 */
export interface QueryCheckInReconciliationPageInput extends PageQueryInput {
  planId?: number
  userId?: number
  cycleId?: number
  recordId?: number
  grantId?: number
  rewardStatus?: CheckInRewardStatusEnum | null
  grantStatus?: CheckInRewardStatusEnum | null
  orderBy?: string
}

/**
 * App 端补签入参。
 */
export interface MakeupCheckInInput {
  signDate: CheckInDateOnly
}

/**
 * 管理端补偿入参。
 */
export interface RepairCheckInRewardInput {
  targetType: CheckInRepairTargetTypeEnum
  recordId?: number
  grantId?: number
}

/**
 * 周期边界计算结果。
 */
export interface CheckInCycleFrame {
  cycleKey: string
  cycleStartDate: CheckInDateOnly
  cycleEndDate: CheckInDateOnly
}

/**
 * 周期聚合重算结果。
 */
export interface CheckInCycleAggregation {
  signedCount: number
  makeupUsedCount: number
  currentStreak: number
  lastSignedDate?: CheckInDateOnly
  streakByDate: Record<CheckInDateOnly, number>
}

/**
 * App 端返回的连续奖励简要视图。
 */
export type CheckInStreakRewardRuleView = CheckInStreakRewardRuleCoreView

/**
 * 签到记录关联的连续奖励视图。
 */
export interface CheckInGrantView {
  id: number
  ruleId: number
  triggerSignDate: CheckInDateOnly
  grantStatus: CheckInRewardStatusEnum
  grantResultType?: CheckInRewardResultTypeEnum | null
  ledgerIds: number[]
  lastGrantError?: string | null
}

/**
 * 签到记录视图。
 */
export interface CheckInRecordView extends CheckInRecordRewardStateView {
  id: number
  signDate: CheckInDateOnly
  recordType: CheckInRecordTypeEnum
  baseRewardLedgerIds: number[]
  lastRewardError?: string | null
  rewardSettledAt?: Date | null
  grants: CheckInGrantView[]
  createdAt: Date
}

/**
 * 签到日历单日视图。
 */
export interface CheckInCalendarDayView {
  signDate: CheckInDateOnly
  isToday: boolean
  isFuture: boolean
  isSigned: boolean
  recordType?: CheckInRecordTypeEnum
  rewardStatus?: CheckInRewardStatusEnum | null
  rewardResultType?: CheckInRewardResultTypeEnum | null
  grantCount: number
}

/**
 * App 端签到摘要视图。
 */
export interface CheckInSummaryView {
  plan?: CheckInPlanSummaryView | null
  cycle?: CheckInSummaryCycleView | null
  todaySigned: boolean
  nextStreakReward?: CheckInStreakRewardRuleView | null
  latestRecord?: CheckInRecordView | null
}

/**
 * App 端签到日历视图。
 */
export interface CheckInCalendarView {
  planId?: CheckInPlanSummaryView['id']
  cycleId?: CheckInSummaryCycleView['id']
  cycleKey?: CheckInCycleWindowView['cycleKey']
  cycleStartDate?: CheckInCycleWindowView['cycleStartDate']
  cycleEndDate?: CheckInCycleWindowView['cycleEndDate']
  days: CheckInCalendarDayView[]
}

/**
 * 签到动作返回视图。
 */
export interface CheckInActionView extends CheckInRecordRewardStateView {
  recordId: number
  cycleId: number
  signDate: CheckInDateOnly
  recordType: CheckInRecordTypeEnum
  currentStreak: number
  signedCount: number
  remainingMakeupCount: number
  triggeredGrantIds: number[]
  alreadyExisted: boolean
}

/**
 * 管理端签到计划列表视图。
 */
export type CheckInPlanPageView = CheckInPlanSnapshotSource & Pick<
  CheckInPlan,
  'status' | 'isEnabled' | 'publishStartAt' | 'publishEndAt' | 'createdAt' | 'updatedAt'
> & {
  ruleCount: number
  activeCycleCount: number
  pendingRewardCount: number
}

/**
 * 管理端签到计划详情视图。
 */
export interface CheckInPlanDetailView extends CheckInPlanPageView {
  streakRewardRules: CheckInStreakRewardRuleView[]
}

/**
 * 管理端签到对账视图。
 */
export interface CheckInReconciliationView extends CheckInRecordRewardStateView {
  recordId: number
  userId: number
  planId: number
  cycleId: number
  signDate: CheckInDateOnly
  recordType: CheckInRecordTypeEnum
  baseRewardLedgerIds: number[]
  lastRewardError?: string | null
  grants: CheckInGrantView[]
  createdAt: Date
}

/**
 * 管理端补偿结果视图。
 */
export interface RepairCheckInRewardView {
  targetType: CheckInRepairTargetTypeEnum
  recordId?: number
  grantId?: number
  success: boolean
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
