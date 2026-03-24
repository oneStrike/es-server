/**
 * 业务场景类型枚举。
 *
 * 说明：
 * - 该枚举用于补充多态交互表的统计维度
 * - `sceneType` 表示直接目标所属的根业务场景，而不是替代各交互表自己的 `targetType`
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
