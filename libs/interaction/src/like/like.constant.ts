import { GrowthRuleTypeEnum } from '@libs/growth'

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

/**
 * 点赞类型映射 Growth 规则
 */
export const LIKE_GROWTH_RULE_TYPE_MAP: Partial<
  Record<LikeTargetTypeEnum, GrowthRuleTypeEnum>
> = {
  [LikeTargetTypeEnum.WORK_COMIC]: GrowthRuleTypeEnum.COMIC_WORK_LIKE,
  [LikeTargetTypeEnum.WORK_NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_LIKE,
  [LikeTargetTypeEnum.WORK_COMIC_CHAPTER]:
    GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
  [LikeTargetTypeEnum.WORK_NOVEL_CHAPTER]:
    GrowthRuleTypeEnum.NOVEL_CHAPTER_LIKE,
  [LikeTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_LIKED,
  [LikeTargetTypeEnum.COMMENT]: GrowthRuleTypeEnum.COMMENT_LIKED,
}
