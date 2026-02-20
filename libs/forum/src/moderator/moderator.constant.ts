/**
 * 版主相关常量定义
 * 覆盖角色类型与权限类型
 */
export enum ForumModeratorRoleTypeEnum {
  /** 超级版主 - 管理所有板块 */
  SUPER = 1,
  /** 分组版主 - 管理指定分组下的所有板块 */
  GROUP = 2,
  /** 板块版主 - 管理指定的一个或多个板块 */
  SECTION = 3,
}

/// 版主角色名称映射
export const ForumModeratorRoleTypeNames: Record<
  ForumModeratorRoleTypeEnum,
  string
> = {
  /** 超级版主 */
  [ForumModeratorRoleTypeEnum.SUPER]: '超级版主',
  /** 分组版主 */
  [ForumModeratorRoleTypeEnum.GROUP]: '分组版主',
  /** 板块版主 */
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

/// 版主权限名称映射
export const ForumModeratorPermissionNames: Record<
  ForumModeratorPermissionEnum,
  string
> = {
  /** 置顶 */
  [ForumModeratorPermissionEnum.PIN]: '置顶',
  /** 加精 */
  [ForumModeratorPermissionEnum.FEATURE]: '加精',
  /** 锁定 */
  [ForumModeratorPermissionEnum.LOCK]: '锁定',
  /** 删除 */
  [ForumModeratorPermissionEnum.DELETE]: '删除',
  /** 审核 */
  [ForumModeratorPermissionEnum.AUDIT]: '审核',
  /** 移动 */
  [ForumModeratorPermissionEnum.MOVE]: '移动',
}
