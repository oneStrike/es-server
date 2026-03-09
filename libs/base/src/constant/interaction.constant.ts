/**
 * 交互目标类型枚举。
 *
 * 说明：
 * - 该枚举用于点赞、收藏、浏览、下载等多态交互表
 * - 与数据库中的 `target_type` 字段一一对应
 */
export enum InteractionTargetTypeEnum {
  /** 漫画作品 */
  COMIC = 1,
  /** 小说作品 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题 */
  FORUM_TOPIC = 5,
  /** 评论 */
  COMMENT = 6,
}

/**
 * 业务场景类型枚举。
 *
 * 说明：
 * - 该枚举用于补充多态交互表的统计维度
 * - `sceneType` 表示直接目标所属的根业务场景，而不是替代 `targetType`
 */
export enum SceneTypeEnum {
  /** 漫画作品场景 */
  COMIC_WORK = 1,
  /** 小说作品场景 */
  NOVEL_WORK = 2,
  /** 漫画章节场景 */
  COMIC_CHAPTER = 3,
  /** 小说章节场景 */
  NOVEL_CHAPTER = 4,
  /** 论坛主题场景 */
  FORUM_TOPIC = 5,
  /** 用户主页场景 */
  USER_PROFILE = 6,
}

/**
 * 业务场景中文名称映射。
 */
export const SceneTypeNames: Record<SceneTypeEnum, string> = {
  [SceneTypeEnum.COMIC_WORK]: '漫画作品',
  [SceneTypeEnum.NOVEL_WORK]: '小说作品',
  [SceneTypeEnum.COMIC_CHAPTER]: '漫画章节',
  [SceneTypeEnum.NOVEL_CHAPTER]: '小说章节',
  [SceneTypeEnum.FORUM_TOPIC]: '论坛主题',
  [SceneTypeEnum.USER_PROFILE]: '用户主页',
}

/**
 * 评论层级枚举。
 *
 * 说明：
 * - 仅当直接目标为评论时有意义
 * - 用于区分根评论与回复评论
 */
export enum CommentLevelEnum {
  /** 根评论 */
  ROOT = 1,
  /** 回复评论 */
  REPLY = 2,
}

/**
 * 评论层级中文名称映射。
 */
export const CommentLevelNames: Record<CommentLevelEnum, string> = {
  [CommentLevelEnum.ROOT]: '根评论',
  [CommentLevelEnum.REPLY]: '回复评论',
}

/**
 * 交互操作类型枚举。
 *
 * 说明：
 * - 用于标识用户针对目标执行的操作
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
  /** 发表评论 */
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
