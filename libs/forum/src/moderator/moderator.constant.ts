export enum ForumModeratorRoleTypeEnum {
  /** 超级版主 - 管理所有板块 */
  SUPER = 1,
  /** 分组版主 - 管理指定分组下的所有板块 */
  GROUP = 2,
  /** 板块版主 - 管理指定的一个或多个板块 */
  SECTION = 3,
}

export const ForumModeratorRoleTypeNames: Record<
  ForumModeratorRoleTypeEnum,
  string
> = {
  [ForumModeratorRoleTypeEnum.SUPER]: '超级版主',
  [ForumModeratorRoleTypeEnum.GROUP]: '分组版主',
  [ForumModeratorRoleTypeEnum.SECTION]: '板块版主',
}

export enum ForumModeratorPermissionEnum {
  /** 置顶 */
  PIN = 1,
  /** 加精 */
  FEATURE = 2,
  /** 锁定 */
  LOCK = 3,
  /** 删除 */
  DELETE = 4,
  /** 审核 */
  AUDIT = 5,
  /** 移动 */
  MOVE = 6,
}

export const ForumModeratorPermissionNames: Record<
  ForumModeratorPermissionEnum,
  string
> = {
  [ForumModeratorPermissionEnum.PIN]: '置顶',
  [ForumModeratorPermissionEnum.FEATURE]: '加精',
  [ForumModeratorPermissionEnum.LOCK]: '锁定',
  [ForumModeratorPermissionEnum.DELETE]: '删除',
  [ForumModeratorPermissionEnum.AUDIT]: '审核',
  [ForumModeratorPermissionEnum.MOVE]: '移动',
}
