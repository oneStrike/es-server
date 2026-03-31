import type {
  Task,
  TaskAssignment,
  TaskInsert,
  TaskProgressLogInsert,
} from '@db/schema'
import type { EventEnvelope } from '@libs/growth/event-definition'
import type { MessageNotificationDispatchStatusEnum } from '@libs/message/notification'
import type {
  PageQueryInput,
  PageQueryNoOrderInput,
  QueryOrderByInput,
} from '@libs/platform/types'
import type { SQL } from 'drizzle-orm'
import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskObjectiveTypeEnum,
  TaskProgressActionTypeEnum,
  TaskProgressSourceEnum,
  TaskReminderKindEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from './task.constant'

/**
 * 任务分页排序入参。
 * 支持对象/对象数组和 JSON 字符串两种形式。
 */
export type TaskQueryOrderByInput = QueryOrderByInput

/**
 * 任务奖励配置。
 *
 * 当前任务域只支持积分和经验两类成长奖励，字段值统一要求为正整数。
 */
export interface TaskRewardConfig {
  points?: number
  experience?: number
}

/**
 * 任务重复规则。
 *
 * `timezone` 仅影响周期切分口径，不改变数据库内时间字段的 UTC 存储方式。
 */
export interface TaskRepeatRuleConfig {
  type: TaskRepeatTypeEnum
  timezone?: string
}

/**
 * 任务目标附加配置。
 *
 * 主要用于 `EVENT_COUNT` 任务对事件上下文做额外筛选。
 */
export interface TaskObjectiveConfig {
  [key: string]: unknown
}

/**
 * 任务分配快照可序列化字段来源。
 */
export type TaskSnapshotSource = Pick<
  Task,
  | 'id'
  | 'code'
  | 'title'
  | 'description'
  | 'cover'
  | 'type'
  | 'claimMode'
  | 'completeMode'
  | 'objectiveType'
  | 'eventCode'
  | 'objectiveConfig'
  | 'repeatRule'
  | 'publishStartAt'
  | 'publishEndAt'
  | 'rewardConfig'
  | 'targetCount'
>

/**
 * 自动领取 assignment 创建所需的任务字段来源。
 *
 * 当前与 `TaskSnapshotSource` 等价，保留语义别名用于区分调用场景。
 */
export type AutoAssignmentTaskSource = TaskSnapshotSource

/**
 * 创建或复用 assignment 时使用的任务字段来源。
 */
export type CreateOrGetAssignmentTaskInput = TaskSnapshotSource

type CreateTaskInsertFields = Pick<
  TaskInsert,
  | 'code'
  | 'title'
  | 'description'
  | 'cover'
  | 'priority'
  | 'isEnabled'
  | 'objectiveType'
  | 'eventCode'
  | 'objectiveConfig'
  | 'targetCount'
  | 'rewardConfig'
  | 'publishStartAt'
  | 'publishEndAt'
  | 'repeatRule'
>

/**
 * 管理端任务创建入参。
 * - 对应任务配置创建表单
 */
export interface CreateTaskInput extends CreateTaskInsertFields {
  type: TaskTypeEnum
  status: TaskStatusEnum
  claimMode: TaskClaimModeEnum
  completeMode: TaskCompleteModeEnum
  objectiveType: TaskObjectiveTypeEnum
  eventCode?: GrowthRuleTypeEnum | number | null
  objectiveConfig?: TaskObjectiveConfig | null
  rewardConfig?: TaskRewardConfig | Record<string, unknown> | null
  repeatRule?: TaskRepeatRuleConfig | Record<string, unknown> | null
}

/**
 * 管理端任务更新入参。
 * - 通过任务 ID 按需更新配置
 */
export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: number
}

/**
 * 管理端任务状态更新入参。
 * - 用于切换发布状态与启用状态
 */
export interface UpdateTaskStatusInput {
  id: number
  status?: TaskStatusEnum
  isEnabled?: boolean
}

/**
 * 管理端任务分页查询条件。
 */
export interface QueryTaskPageInput extends PageQueryNoOrderInput {
  title?: string
  status?: TaskStatusEnum
  type?: TaskTypeEnum
  isEnabled?: boolean
}

/**
 * 管理端任务分配分页查询条件。
 */
export interface QueryTaskAssignmentPageInput extends PageQueryInput {
  taskId?: number
  userId?: number
  status?: TaskAssignmentStatusEnum
}

/**
 * 管理端任务奖励/通知对账分页查询条件。
 */
export interface QueryTaskAssignmentReconciliationPageInput
  extends PageQueryInput {
  assignmentId?: number
  taskId?: number
  userId?: number
  eventCode?: GrowthRuleTypeEnum
  eventBizKey?: string
  rewardStatus?: TaskAssignmentRewardStatusEnum
  notificationStatus?: MessageNotificationDispatchStatusEnum
}

/**
 * App 端可领取任务查询条件。
 */
export interface QueryAppTaskInput extends PageQueryNoOrderInput {
  type?: TaskTypeEnum
}

/**
 * App 端我的任务查询条件。
 */
export interface QueryMyTaskInput extends PageQueryInput {
  status?: TaskAssignmentStatusEnum
  type?: TaskTypeEnum
}

/**
 * 领取任务入参。
 */
export interface ClaimTaskInput {
  taskId: number
}

/**
 * 任务进度上报入参。
 */
export interface TaskProgressInput {
  taskId: number
  delta: number
  context?: string
}

/**
 * 手动完成任务入参。
 */
export interface TaskCompleteInput {
  taskId: number
}

/**
 * 任务事件推进入参。
 */
export interface TaskEventProgressInput {
  eventEnvelope: EventEnvelope<GrowthRuleTypeEnum>
  bizKey: string
}

/**
 * 任务事件推进结果。
 */
export interface TaskEventProgressResult {
  matchedTaskIds: number[]
  progressedAssignmentIds: number[]
  completedAssignmentIds: number[]
  duplicateAssignmentIds: number[]
}

/**
 * 创建或复用 assignment 的附加选项。
 */
export interface CreateOrGetAssignmentOptions {
  notifyAutoAssignment?: boolean
  progressSource?: TaskProgressSourceEnum
}

/**
 * 任务分配分页共享查询参数。
 */
export interface QueryTaskAssignmentPageParams {
  assignmentWhereClause?: SQL
  taskWhereClause?: SQL
  pageIndex?: PageQueryInput['pageIndex']
  pageSize?: PageQueryInput['pageSize']
  orderBy?: TaskQueryOrderByInput
}

/**
 * 任务分配分页查询结果。
 */
export interface QueryTaskAssignmentPageResult {
  list: TaskAssignmentWithTaskRow[]
  total: number
  pageIndex: number
  pageSize: number
}

/**
 * 落任务进度日志时使用的稳定输入。
 *
 * 字段定义优先复用 `task_progress_log` schema，行为语义由 task 域枚举补充约束。
 */
export interface TaskProgressLogRecordInput {
  assignmentId: TaskProgressLogInsert['assignmentId']
  userId: TaskProgressLogInsert['userId']
  actionType: TaskProgressActionTypeEnum
  progressSource: TaskProgressSourceEnum
  delta: TaskProgressLogInsert['delta']
  beforeValue: TaskProgressLogInsert['beforeValue']
  afterValue: TaskProgressLogInsert['afterValue']
  context?: TaskProgressLogInsert['context']
  eventCode?: GrowthRuleTypeEnum | null
  eventBizKey?: TaskProgressLogInsert['eventBizKey']
  eventOccurredAt?: TaskProgressLogInsert['eventOccurredAt']
}

/**
 * 校验任务目标模型合同的输入。
 */
export interface EnsureTaskObjectiveContractInput {
  objectiveType: TaskObjectiveTypeEnum
  eventCode?: GrowthRuleTypeEnum | null
  objectiveConfig?: Task['objectiveConfig']
}

/**
 * 批量收口 assignment 过期状态时使用的共享输入。
 */
export interface ExpireAssignmentsByWhereInput {
  now: Date
  whereClause: SQL
  overrideExpiredAt?: TaskAssignment['expiredAt']
}

/**
 * 使用业务事件推进 assignment 的输入。
 */
export interface AdvanceAssignmentByEventInput {
  taskRecord: Task
  userId: TaskAssignment['userId']
  eventEnvelope: TaskEventProgressInput['eventEnvelope']
  eventBizKey: string
  occurredAt: Date
}

/**
 * 在事务内应用一次事件推进的输入。
 */
export interface ApplyAssignmentEventProgressInput {
  assignment: TaskAssignment
  userId: TaskAssignment['userId']
  nextProgress: TaskAssignment['progress']
  nextStatus: TaskAssignmentStatusEnum
  eventCode: GrowthRuleTypeEnum
  eventBizKey: string
  eventOccurredAt: Date
  context: Record<string, unknown>
}

/**
 * 统一映射用户可见状态时使用的输入。
 */
export interface ResolveTaskUserVisibleStatusInput {
  status: TaskAssignmentStatusEnum
  rewardStatus?: TaskAssignmentRewardStatusEnum | null
  rewardConfig?: unknown
}

/**
 * 构建任务完成事件 envelope 的输入。
 */
export interface BuildTaskCompleteEventEnvelopeInput {
  userId: TaskAssignment['userId']
  taskId: Task['id']
  assignmentId: TaskAssignment['id']
  occurredAt?: Date
}

/**
 * 联表查询时的任务关联行。
 *
 * 分页 helper 固定返回同一组任务摘要字段；值为 `null` 表示 left join 未命中
 * live task，只能回退到 assignment 快照。
 */
export interface TaskRelationRow {
  id: Task['id'] | null
  code: Task['code'] | null
  title: Task['title'] | null
  description: Task['description'] | null
  cover: Task['cover'] | null
  type: Task['type'] | null
  objectiveType: Task['objectiveType'] | null
  eventCode: Task['eventCode'] | null
  objectiveConfig: Task['objectiveConfig'] | null
  rewardConfig: Task['rewardConfig'] | null
  targetCount: Task['targetCount'] | null
  completeMode: Task['completeMode'] | null
  claimMode: Task['claimMode'] | null
}

/**
 * 带 live task 关联信息的 assignment 行。
 */
export interface TaskAssignmentWithTaskRow extends TaskAssignment {
  task?: TaskRelationRow | null
}

/**
 * 构建奖励结算最小任务视图时使用的 live task 来源。
 */
export type TaskRewardTaskRecordBuildCurrentTaskInput = Partial<
  Omit<TaskRewardTaskRecord, 'id'>
>

/**
 * 构建奖励结算最小任务视图时使用的 assignment 来源。
 */
export type TaskRewardTaskRecordBuildAssignmentInput = Pick<
  TaskAssignment,
  'taskSnapshot'
>

/**
 * 奖励结算与奖励提醒复用的最小任务视图。
 */
export interface TaskRewardTaskRecord {
  id: Task['id']
  code?: Task['code'] | null
  title?: Task['title'] | null
  type?: Task['type'] | null
  rewardConfig: Task['rewardConfig'] | undefined
}

/**
 * 触发任务完成事件时使用的最小任务视图。
 */
export type TaskCompleteEventTaskInput = Pick<
  TaskRewardTaskRecord,
  'id' | 'title' | 'rewardConfig'
>

/**
 * 触发任务完成事件时使用的最小 assignment 视图。
 */
export interface TaskCompleteEventAssignmentInput {
  id: TaskAssignment['id']
  completedAt?: TaskAssignment['completedAt']
}

/**
 * 按需补发任务奖励时使用的最小任务视图。
 */
export type TaskRewardSettlementTaskInput = Pick<
  TaskRewardTaskRecord,
  'id' | 'rewardConfig'
>

/**
 * 按需补发任务奖励时使用的最小 assignment 视图。
 */
export type TaskRewardSettlementAssignmentInput = Pick<
  TaskAssignment,
  'id' | 'rewardStatus'
>

/**
 * 奖励到账提醒复用的最小任务视图。
 */
export type TaskRewardReminderTaskInput = Pick<
  TaskRewardTaskRecord,
  'id' | 'code' | 'title' | 'type'
>

/**
 * 任务提醒链路复用的最小任务视图。
 */
export type TaskReminderNotificationTaskInfo = Omit<
  TaskRewardReminderTaskInput,
  'title'
> & {
  title: NonNullable<Task['title']>
}

/**
 * 自动分配提醒复用的最小任务视图。
 */
export type TaskAutoAssignmentReminderTaskInput =
  TaskReminderNotificationTaskInfo & {
  claimMode?: Task['claimMode']
}

/**
 * 任务提醒链路复用的最小 assignment 视图。
 */
export type TaskReminderAssignmentInput = Pick<TaskAssignment, 'id'>

/**
 * 任务提醒事件的共享基础入参。
 */
export interface TaskReminderBaseInput {
  bizKey: string
  receiverUserId: TaskAssignment['userId']
  task: TaskReminderNotificationTaskInfo
  cycleKey?: string
  assignmentId?: TaskReminderAssignmentInput['id']
}

/**
 * “可领取任务”提醒入参。
 */
export interface TaskAvailableReminderEventInput extends TaskReminderBaseInput {
  claimMode?: Task['claimMode']
}

/**
 * “即将过期”提醒入参。
 */
export interface TaskExpiringSoonReminderEventInput
  extends TaskReminderBaseInput {
  expiredAt: NonNullable<TaskAssignment['expiredAt']>
}

/**
 * “奖励到账”提醒入参。
 */
export interface TaskRewardGrantedReminderEventInput
  extends TaskReminderBaseInput {
  points: number
  experience: number
  ledgerRecordIds: number[]
}

/**
 * 任务提醒内部组装阶段的统一输入。
 */
export interface TaskReminderNotificationEventInput
  extends TaskReminderBaseInput {
  reminderKind: TaskReminderKindEnum
  claimMode?: Task['claimMode']
  expiredAt?: NonNullable<TaskAssignment['expiredAt']>
  points?: number
  experience?: number
  ledgerRecordIds?: number[]
}

/**
 * 任务提醒 payload 中的奖励摘要。
 */
export interface TaskReminderRewardSummary {
  points: number
  experience: number
  ledgerRecordIds: number[]
}

/**
 * 任务提醒 payload 的稳定业务合同。
 */
export interface TaskReminderNotificationPayload {
  payloadVersion: number
  reminderKind: TaskReminderKindEnum
  taskId: Task['id']
  taskCode: string
  title: string
  taskTitle: string
  sceneType: TaskTypeEnum
  cycleKey?: string
  assignmentId?: TaskReminderAssignmentInput['id']
  expiredAt?: NonNullable<TaskAssignment['expiredAt']>
  actionUrl: '/task/my' | '/task/available'
  rewardSummary?: TaskReminderRewardSummary
  points?: number
  experience?: number
  ledgerRecordIds?: number[]
}

/**
 * 管理端任务运行态中最近一次提醒摘要。
 */
export interface TaskRuntimeHealthLatestReminder {
  reminderKind?: string
  status: MessageNotificationDispatchStatusEnum
  failureReason?: string
  lastAttemptAt: Date
  updatedAt: Date
}

/**
 * 管理端任务页聚合展示的运行态摘要。
 */
export interface TaskRuntimeHealthSummary {
  activeAssignmentCount: number
  pendingRewardCompensationCount: number
  latestReminder?: TaskRuntimeHealthLatestReminder
}

/**
 * 任务维度最近一次提醒投递结果原始行。
 */
export interface TaskLatestReminderRow {
  taskId: Task['id']
  reminderKind: string | null
  status: MessageNotificationDispatchStatusEnum
  failureReason: string | null
  lastAttemptAt: Date
  updatedAt: Date
}

/**
 * assignment 最近一次命中的事件摘要。
 */
export interface TaskAssignmentEventProgressSummary {
  eventCode: GrowthRuleTypeEnum | null
  eventBizKey: TaskProgressLogInsert['eventBizKey']
  eventOccurredAt: TaskProgressLogInsert['eventOccurredAt']
}

/**
 * assignment 最近一次奖励到账提醒摘要。
 */
export interface TaskAssignmentRewardReminderSummary {
  bizKey: string
  status: MessageNotificationDispatchStatusEnum
  failureReason: string | null
  lastAttemptAt: Date
}
