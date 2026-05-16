import type { BackgroundTaskOperatorTypeEnum } from '../background-task.constant'
import type { BackgroundTaskObject } from './background-task-handler.type'

/** 后台任务后台管理员操作者。 */
export interface BackgroundTaskAdminOperator {
  type: BackgroundTaskOperatorTypeEnum.ADMIN
  userId: number
}

/** 后台任务系统操作者。 */
export interface BackgroundTaskSystemOperator {
  type: BackgroundTaskOperatorTypeEnum.SYSTEM
  userId?: null
}

/** 后台任务操作者。 */
export type BackgroundTaskOperator =
  | BackgroundTaskAdminOperator
  | BackgroundTaskSystemOperator

/** 创建后台任务内部入参。 */
export interface CreateBackgroundTaskInput {
  taskType: string
  payload: BackgroundTaskObject
  operator: BackgroundTaskOperator
  maxRetries?: number
  dedupeKey?: string
  dedupeConflictMessage?: string
  serialKey?: string
  conflictKeys?: string[]
  conflictMessageByKey?: Record<string, string>
}
