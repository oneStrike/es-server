/**
 * 交互目标类型枚举
 * 用于标识用户交互操作的目标对象类型
 */
export enum InteractionTargetTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 */
  FORUM_TOPIC = 5,
}

/**
 * 交互操作类型枚举
 * 用于标识用户对目标执行的操作类型
 */
export enum InteractionActionType {
  /** 点赞 */
  LIKE = 1,
  /** 取消点赞 */
  UNLIKE = 2,
  /** 收藏 */
  FAVORITE = 3,
  /** 取消收藏 */
  UNFAVORITE = 4,
  /** 浏览 */
  VIEW = 5,
  /** 删除浏览记录 */
  DELETE_VIEW = 6,
  /** 评论 */
  COMMENT = 7,
  /** 删除评论 */
  DELETE_COMMENT = 8,
  /** 下载 */
  DOWNLOAD = 9,
  /** 购买 */
  PURCHASE = 10,
  /** 退款 */
  REFUND = 11,
}
