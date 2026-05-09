import type { Db } from '@db/core'
import type {
  GrowthRewardSettlementSelect,
  TaskDefinitionSelect,
  TaskInstanceSelect,
  TaskInstanceStepSelect,
  TaskStepSelect,
} from '@db/schema'
import type {
  EventEnvelope,
  EventEnvelopeContext,
} from '@libs/growth/event-definition/event-envelope.type'
import type {
  NotificationTaskReminderData,
  NotificationTaskRewardSnapshot,
} from '@libs/message/notification/notification-contract.type'
import type { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import type { GrowthRewardItem } from '../../reward-rule/reward-item.type'
import type { CreateTaskStepDto } from '../dto/task-admin.dto'
import type {
  TaskInstanceStatusEnum,
  TaskReminderKindEnum,
} from '../task.constant'

/** 任务事件推进入参。 */
export interface TaskEventProgressInput {
  eventEnvelope: EventEnvelope<GrowthRuleTypeEnum>
  bizKey: string
}

/** 任务事件推进结果。 */
export interface TaskEventProgressResult {
  matchedTaskIds: number[]
  progressedInstanceIds: number[]
  completedInstanceIds: number[]
  duplicateInstanceIds: number[]
}

/** 任务定义运行态摘要。 */
export interface TaskDefinitionRuntimeSummary {
  activeInstanceCount: number
  pendingRewardCompensationCount: number
}

/** 结构化过滤条件视图。 */
export interface TaskStepFilterValueView {
  key: string
  label?: string
  value: string
}

/** 任务步骤写入合同的外部输入字段集。 */
export type TaskStepWriteSourceInput = Partial<CreateTaskStepDto>

/** 任务步骤写入合同的内部归一化视图。 */
export interface TaskStepWriteInput {
  title: string
  description?: string
  triggerMode: TaskStepSelect['triggerMode']
  eventCode?: TaskStepSelect['eventCode']
  targetValue: TaskStepSelect['targetValue']
  templateKey?: TaskStepSelect['templateKey']
  filterPayload?: TaskStepSelect['filterPayload']
  dedupeScope?: TaskStepSelect['dedupeScope']
}

/** 统一计算用户可见状态时使用的最小输入。 */
export interface TaskVisibleStatusInput {
  status: number
  rewardApplicable: number
  rewardSettlementStatus?:
    | GrowthRewardSettlementSelect['settlementStatus']
    | null
}

/** 按任务周期切分时使用的日期片段。 */
export interface TaskCycleDateParts {
  year: string
  month: string
  date: string
  weekday: number
}

/** 单条步骤摘要视图。 */
export interface TaskStepSummaryView {
  id: TaskStepSelect['id']
  createdAt: TaskStepSelect['createdAt']
  updatedAt: TaskStepSelect['updatedAt']
  stepKey: TaskStepSelect['stepKey']
  title: TaskStepSelect['title']
  description?: string
  stepNo: TaskStepSelect['stepNo']
  triggerMode: TaskStepSelect['triggerMode']
  targetValue: TaskStepSelect['targetValue']
  templateKey?: string
  filters?: TaskStepFilterValueView[]
  dedupeScope?: number
}

/** 单条实例步骤进度视图。 */
export interface TaskInstanceStepViewRecord {
  id: number
  createdAt: Date
  updatedAt: Date
  stepId: number
  status: number
  currentValue: number
  targetValue: number
  completedAt: Date | null
}

/** 对账页使用的最近事件摘要。 */
export interface TaskLatestEventSummaryRecord {
  eventBizKey: string | null
  occurredAt: Date | null
  accepted: boolean
  rejectReason: string | null
  targetType: string | null
  targetId: number | null
}

/** 对账页使用的唯一事实摘要。 */
export interface TaskUniqueFactSummaryRecord {
  stepId: number
  dedupeScope: number
  factCount: number
  latestDimensionValue: string | null
  latestOccurredAt: Date | null
}

/** 唯一维度解析结果。 */
export interface TaskUniqueDimensionResolvedValue {
  key: string
  value: string
}

/** 单次事件命中某步骤时的内部入参。 */
export interface TaskInstanceEventApplyParams {
  task: TaskDefinitionSelect
  step: TaskStepSelect
  userId: number
  eventBizKey: string
  eventCode: number
  targetType: string
  targetId: number
  occurredAt: Date
  context?: Record<string, unknown>
}

/** 单次事件命中某步骤后的内部结果。 */
export interface TaskInstanceEventApplyResult {
  instanceId: number | null
  progressed: boolean
  completed: boolean
  duplicate: boolean
  rewardItems?: unknown
}

/** 写入唯一计数事实时的内部入参。 */
export interface TaskUniqueFactInsertInput {
  taskId: number
  stepId: number
  userId: number
  cycleKey: string
  dedupeScope: number
  dimension: TaskUniqueDimensionResolvedValue
  eventCode: number
  eventBizKey: string
  targetType: string
  targetId: number
  occurredAt: Date
  context?: Record<string, unknown>
}

/** 写入事件日志时的内部入参。 */
export interface TaskEventLogWriteInput {
  taskId: number
  stepId?: number | null
  instanceId?: number | null
  instanceStepId?: number | null
  userId: number
  eventCode?: number | null
  eventBizKey?: string | null
  actionType: number
  progressSource?: number
  accepted: boolean
  rejectReason?: string | null
  delta?: number
  beforeValue?: number
  afterValue?: number
  targetType?: string | null
  targetId?: number | null
  dimensionKey?: string | null
  dimensionValue?: string | null
  occurredAt?: Date | null
  context?: Record<string, unknown>
}

/** 任务奖励结算幂等键入参。 */
export interface TaskRewardSettlementBizKeyInput {
  taskId: number
  instanceId: number
  userId: number
}

/** 任务奖励结算事实补建入参。 */
export interface TaskRewardSettlementLinkInput extends TaskRewardSettlementBizKeyInput {
  rewardItems: unknown
  occurredAt: Date
}

/** 任务奖励执行入参。 */
export interface TaskRewardSettlementInput extends TaskRewardSettlementBizKeyInput {
  rewardItems: unknown
  occurredAt: Date
}

/** 创建或复用任务实例的结果。 */
export interface TaskInstanceResolveResult {
  instance: TaskInstanceSelect
  created: boolean
}

/** 创建或复用任务实例步骤的结果。 */
export interface TaskInstanceStepResolveResult {
  instanceStep: TaskInstanceStepSelect
  created: boolean
}

/** 单次任务实例步骤进度推进入参。 */
export interface TaskInstanceProgressApplyInput {
  runner: Db
  instance: TaskInstanceSelect
  instanceStep: TaskInstanceStepSelect
  delta: number
  occurredAt: Date
}

/** 单次任务实例步骤进度推进结果。 */
export interface TaskInstanceProgressApplyResult {
  instanceId: number
  instanceStepId: number
  beforeValue: number
  afterValue: number
  appliedDelta: number
  targetValue: number
  status: TaskInstanceStatusEnum
  completed: boolean
}

/** 任务奖励到账通知投递入参。 */
export interface TaskRewardGrantedPublishInput {
  taskId: number
  instanceId: number
  userId: number
  rewardItems: GrowthRewardItem[]
  ledgerRecordIds: number[]
  occurredAt: Date
}

/** 原生 SQL 进度推进返回行。 */
export interface TaskProgressUpdateRawRow {
  instanceId: number
  instanceStepId: number
  beforeValue: number
  afterValue: number
  appliedDelta: number
  targetValue: number
  status: number
}

/** 到期任务实例批量关闭 SQL 返回行。 */
export interface TaskExpiredInstanceRawRow {
  instanceId: number
  taskId: number
  userId: number
}

/** 奖励结算补偿更新结果。 */
export interface TaskRewardSettlementUpdateResult {
  updated: boolean
}

/** 任务提醒快照中的最小任务载荷。 */
export interface TaskReminderSnapshotPayload {
  code?: string | null
  title?: string | null
  sceneType?: number | null
}

/** 对账查询中实例作用域的最小视图。 */
export interface TaskReconciliationInstanceRecord {
  id: number
  taskId: number
  userId: number
  cycleKey: string
}

/** 任务提醒里使用的最小任务快照。 */
export interface TaskReminderNotificationTaskInfo {
  id: number
  code?: string | null
  title: string
  type: number | null | undefined
}

/** 任务提醒公共入参。 */
export interface TaskReminderBaseInput {
  bizKey: string
  receiverUserId: number
  task: TaskReminderNotificationTaskInfo
  cycleKey?: string
  instanceId?: number
}

/** 自动加入任务后的提醒入参。 */
export interface TaskAutoAssignedReminderEventInput extends TaskReminderBaseInput {}

/** 即将过期提醒入参。 */
export interface TaskExpiringSoonReminderEventInput extends TaskReminderBaseInput {
  expiredAt: Date
}

/** 奖励到账提醒入参。 */
export interface TaskRewardGrantedReminderEventInput extends TaskReminderBaseInput {
  rewardItems: GrowthRewardItem[]
  ledgerRecordIds: number[]
}

/** 任务提醒统一内部载荷。 */
export interface TaskReminderNotificationEventInput extends TaskReminderBaseInput {
  reminderKind: TaskReminderKindEnum
  expiredAt?: Date
  rewardItems?: GrowthRewardItem[]
  ledgerRecordIds?: number[]
}

/** 任务提醒奖励摘要。 */
export type TaskReminderRewardSummary = NotificationTaskRewardSnapshot

/** 任务提醒允许透出的奖励资产类型。 */
export type TaskReminderRewardAssetType =
  NonNullable<TaskReminderRewardSummary>['items'][number]['assetType']

/** 任务提醒通知 payload。 */
export type TaskReminderNotificationPayload = NotificationTaskReminderData

/** 任务提醒子类型。 */
export type TaskReminderNotificationKind =
  TaskReminderNotificationPayload['reminder']['kind']

/** 任务提醒消息。 */
export interface TaskReminderMessage {
  title: string
  content: string
}

/** 任务提醒事件键。 */
export type TaskReminderEventKey =
  | 'task.reminder.auto_assigned'
  | 'task.reminder.expiring'
  | 'task.reminder.reward_granted'

/** 任务步骤过滤配置。 */
export type TaskEventFilterPayload = EventEnvelopeContext | null | undefined
