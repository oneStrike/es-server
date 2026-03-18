/**
 * 评论目标类型枚举
 * 定义所有支持评论的目标类型，并映射到数据库 user_comment 表的 target_type 字段
 */
export enum CommentTargetTypeEnum {
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
}
