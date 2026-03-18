/**
 * 点赞目标类型枚举
 * 定义所有支持点赞的目标类型
 */
export enum LikeTargetTypeEnum {
  /** 漫画作品 */
  WORK_COMIC = 1,
  /** 小说作品 */
  WORK_NOVEL = 2,
  /** 论坛主题 */
  FORUM_TOPIC = 3,
  /** 漫画章节 */
  WORK_COMIC_CHAPTER = 4,
  /** 小说章节 */
  WORK_NOVEL_CHAPTER = 5,
  /** 评论 */
  COMMENT = 6,
}
