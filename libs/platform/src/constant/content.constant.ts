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
  NOVEL = 2
}

/**
 * 作品可见权限枚举
 */
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
