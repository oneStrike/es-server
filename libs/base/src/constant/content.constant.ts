/// 内容类型枚举
export enum ContentTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
}

export enum BusinessModuleEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
  /** 论坛 */
  FORUM = 3,
}

/// 作品可见权限枚举
export enum WorkViewPermissionEnum {
  INHERIT = -1,
  /** 所有人可见 */
  ALL = 0,
  /** 登录用户可见 */
  LOGGED_IN = 1,
  /** 会员可见 */
  MEMBER = 2,
  /** 需购买可见 */
  PURCHASE = 3,
}
