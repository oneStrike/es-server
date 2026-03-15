import { GrowthRuleTypeEnum } from '@libs/growth'

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

/**
 * 评论类型映射 Growth 规则
 * 用于在发表评论后发放对应的成长奖励
 */
export const COMMENT_GROWTH_RULE_TYPE_MAP: Partial<
  Record<CommentTargetTypeEnum, GrowthRuleTypeEnum>
> = {
  [CommentTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_COMMENT,
  [CommentTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_COMMENT,
  [CommentTargetTypeEnum.COMIC_CHAPTER]: GrowthRuleTypeEnum.COMIC_CHAPTER_COMMENT,
  [CommentTargetTypeEnum.NOVEL_CHAPTER]: GrowthRuleTypeEnum.NOVEL_CHAPTER_COMMENT,
  [CommentTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_COMMENT,
}
