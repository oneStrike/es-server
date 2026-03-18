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
  /** 论坛主题 */
  FORUM_TOPIC = 3,
  /** 漫画章节 */
  COMIC_CHAPTER = 10,
  /** 小说章节 */
  NOVEL_CHAPTER = 11,
  /** 评论 */
  COMMENT = 12,
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
  /** 论坛主题场景 */
  FORUM_TOPIC = 3,
  /** 漫画章节场景 */
  COMIC_CHAPTER = 10,
  /** 小说章节场景 */
  NOVEL_CHAPTER = 11,
  /** 用户主页场景 */
  USER_PROFILE = 12,
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

