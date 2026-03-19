import type { ForumUserActionLog } from '@db/schema'

/**
 * 创建论坛操作日志的领域输入。
 * 用于记录用户对主题/回复的行为轨迹。
 */
export type CreateForumActionLogInput = Pick<
  ForumUserActionLog,
  'userId' | 'actionType' | 'targetType' | 'targetId'
> &
Partial<
    Pick<
      ForumUserActionLog,
      'beforeData' | 'afterData' | 'ipAddress' | 'userAgent'
    >
  >

/**
 * 查询论坛操作日志的条件。
 * 支持按用户、动作、目标分页筛选。
 */
export interface QueryForumActionLogInput {
  userId?: number
  actionType?: number
  targetType?: number
  targetId?: number
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}
