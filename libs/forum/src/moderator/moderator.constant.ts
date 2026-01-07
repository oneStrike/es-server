export enum ModeratorRoleTypeEnum {
  /** 超级版主 - 管理所有板块 */
  SUPER = 1,
  /** 分组版主 - 管理指定分组下的所有板块 */
  GROUP = 2,
  /** 板块版主 - 管理指定的一个或多个板块 */
  SECTION = 3,
}

export const ModeratorRoleTypeNames: Record<ModeratorRoleTypeEnum, string> = {
  [ModeratorRoleTypeEnum.SUPER]: '超级版主',
  [ModeratorRoleTypeEnum.GROUP]: '分组版主',
  [ModeratorRoleTypeEnum.SECTION]: '板块版主',
}

export enum ModeratorPermissionEnum {
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

export const ModeratorPermissionNames: Record<ModeratorPermissionEnum, string> = {
  [ModeratorPermissionEnum.PIN]: '置顶',
  [ModeratorPermissionEnum.FEATURE]: '加精',
  [ModeratorPermissionEnum.LOCK]: '锁定',
  [ModeratorPermissionEnum.DELETE]: '删除',
  [ModeratorPermissionEnum.AUDIT]: '审核',
  [ModeratorPermissionEnum.MOVE]: '移动',
}
