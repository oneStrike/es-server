/** 版主生命周期事件类型。 */
export enum ForumModeratorLifecycleEventTypeEnum {
  /** 后台创建全新版主身份。 */
  CREATE = 1,
  /** 后台恢复软删除版主身份。 */
  RESTORE = 2,
  /** 后台更新角色、分组、权限或备注等作用域信息。 */
  UPDATE_SCOPE = 3,
  /** 后台分配板块版主管理范围。 */
  ASSIGN_SECTION = 4,
  /** 后台启用版主。 */
  ENABLE = 5,
  /** 后台禁用版主。 */
  DISABLE = 6,
  /** 后台移除版主。 */
  REMOVE = 7,
  /** 后台审核通过版主申请。 */
  APPLICATION_APPROVE = 8,
  /** 后台审核拒绝版主申请。 */
  APPLICATION_REJECT = 9,
}

export const FORUM_MODERATOR_LIFECYCLE_EVENT_LABELS: Record<
  ForumModeratorLifecycleEventTypeEnum,
  string
> = {
  [ForumModeratorLifecycleEventTypeEnum.CREATE]: '创建版主',
  [ForumModeratorLifecycleEventTypeEnum.RESTORE]: '恢复版主',
  [ForumModeratorLifecycleEventTypeEnum.UPDATE_SCOPE]: '更新作用域',
  [ForumModeratorLifecycleEventTypeEnum.ASSIGN_SECTION]: '分配板块',
  [ForumModeratorLifecycleEventTypeEnum.ENABLE]: '启用版主',
  [ForumModeratorLifecycleEventTypeEnum.DISABLE]: '禁用版主',
  [ForumModeratorLifecycleEventTypeEnum.REMOVE]: '移除版主',
  [ForumModeratorLifecycleEventTypeEnum.APPLICATION_APPROVE]: '申请通过',
  [ForumModeratorLifecycleEventTypeEnum.APPLICATION_REJECT]: '申请拒绝',
}
