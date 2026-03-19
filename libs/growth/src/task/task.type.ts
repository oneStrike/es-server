import type { TaskAssignmentStatusEnum, TaskStatusEnum, TaskTypeEnum } from './task.constant'

/**
 * 管理端任务创建入参。
 * - 对应任务配置创建表单
 */
export interface CreateTaskInput {
  code: string
  title: string
  description?: string
  cover?: string
  type: TaskTypeEnum
  status: TaskStatusEnum
  priority: number
  isEnabled: boolean
  claimMode: number
  completeMode: number
  targetCount: number
  rewardConfig?: Record<string, unknown> | null
  publishStartAt?: Date
  publishEndAt?: Date
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
export interface QueryTaskPageInput {
  title?: string
  status?: TaskStatusEnum
  type?: TaskTypeEnum
  isEnabled?: boolean
  pageIndex?: number
  pageSize?: number
}

/**
 * 管理端任务分配分页查询条件。
 */
export interface QueryTaskAssignmentPageInput {
  taskId?: number
  userId?: number
  status?: TaskAssignmentStatusEnum
  pageIndex?: number
  pageSize?: number
  orderBy?: unknown
}

/**
 * App 端可领取任务查询条件。
 */
export interface QueryAppTaskInput {
  type?: TaskTypeEnum
  pageIndex?: number
  pageSize?: number
}

/**
 * App 端我的任务查询条件。
 */
export interface QueryMyTaskInput {
  status?: TaskAssignmentStatusEnum
  type?: TaskTypeEnum
  pageIndex?: number
  pageSize?: number
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
