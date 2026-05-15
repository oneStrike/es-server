import type { BackgroundTaskSelect } from '@db/schema'

/** 后台任务通知轮询查询行，仅包含高频通知接口需要的轻量字段。 */
export type BackgroundTaskNotificationSelect = Pick<
  BackgroundTaskSelect,
  'progress' | 'status' | 'taskId' | 'taskType' | 'updatedAt'
>
