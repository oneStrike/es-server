import { SceneTypeEnum } from '@libs/platform/constant/interaction.constant';

/**
 * 评论目标类型枚举
 * 定义所有支持评论的目标类型，并映射到数据库 app_user_comment 表的 target_type 字段
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

/**
 * 评论模块只允许挂载到根业务对象，不支持继续挂载评论。
 */
export function mapCommentTargetTypeToSceneType(
  targetType: CommentTargetTypeEnum,
): SceneTypeEnum | null {
  switch (targetType) {
    case CommentTargetTypeEnum.COMIC:
      return SceneTypeEnum.COMIC_WORK
    case CommentTargetTypeEnum.NOVEL:
      return SceneTypeEnum.NOVEL_WORK
    case CommentTargetTypeEnum.COMIC_CHAPTER:
      return SceneTypeEnum.COMIC_CHAPTER
    case CommentTargetTypeEnum.NOVEL_CHAPTER:
      return SceneTypeEnum.NOVEL_CHAPTER
    case CommentTargetTypeEnum.FORUM_TOPIC:
      return SceneTypeEnum.FORUM_TOPIC
    default:
      return null
  }
}
