/**
 * 内容类型枚举
 * 统一覆盖作品与论坛内容的顶层分类。
 */
export enum ContentTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
  /** 帖子 */
  TOPIC = 3,
}

/**
 * 作品类型枚举
 * 仅覆盖作品域，复用内容类型中的漫画/小说取值。
 */
export enum WorkTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
}

/**
 * 作品级可见权限枚举。
 * 仅用于 work.view_rule，不包含章节继承父级的特殊值。
 */
export enum WorkRootViewPermissionEnum {
  /** 所有人可见 */
  ALL = 0,
  /** 登录用户可见 */
  LOGGED_IN = 1,
  /** VIP 可见 */
  VIP = 2,
  /** 需购买可见 */
  PURCHASE = 3,
}

/**
 * 章节可见权限枚举。
 * 章节允许通过 INHERIT 继承作品级权限。
 */
export enum WorkViewPermissionEnum {
  /** 继承父级权限 */
  INHERIT = -1,
  /** 所有人可见 */
  ALL = 0,
  /** 登录用户可见 */
  LOGGED_IN = 1,
  /** VIP 可见 */
  VIP = 2,
  /** 需购买可见 */
  PURCHASE = 3,
}
