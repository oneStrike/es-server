import type { TaskInsert, TaskSelect } from '@db/schema'
import type { EventEnvelope } from '@libs/growth/event-definition'
import type { MessageNotificationDispatchStatusEnum } from '@libs/message/notification'
import type {
  PageQueryInput,
  PageQueryNoOrderInput,
  QueryOrderByInput,
} from '@libs/platform/types'
import type {
  GrowthRuleTypeEnum,
} from '../growth-rule.constant'
import type {
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskObjectiveTypeEnum,
  TaskRepeatTypeEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from './task.constant'

/**
 * 任务分页排序入参。
 * 支持对象/对象数组和 JSON 字符串两种形式。
 */
export type TaskQueryOrderByInput = QueryOrderByInput

export interface TaskRewardConfig {
  points?: number
  experience?: number
}

export interface TaskRepeatRuleConfig {
  type: TaskRepeatTypeEnum
  timezone?: string
}

export interface TaskObjectiveConfig {
  [key: string]: unknown
}

/**
 * 任务分配快照可序列化字段来源。
 */
export type TaskSnapshotSource = Pick<
  TaskSelect,
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
 * 自动分配逻辑所需的任务字段来源。
 */
export type AutoAssignmentTaskSource = Pick<
  TaskSelect,
  | 'id'
  | 'code'
  | 'title'
  | 'description'
  | 'cover'
  | 'type'
  | 'completeMode'
  | 'objectiveType'
  | 'eventCode'
  | 'objectiveConfig'
  | 'rewardConfig'
  | 'targetCount'
  | 'claimMode'
  | 'publishStartAt'
  | 'publishEndAt'
  | 'repeatRule'
>

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
  rewardConfig?: Record<string, unknown> | null
  repeatRule?: Record<string, unknown> | null
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
 * 批量补偿已完成任务奖励的结果摘要。
 */
export interface RetryCompletedAssignmentRewardsResult {
  scannedCount: number
  triggeredCount: number
}
