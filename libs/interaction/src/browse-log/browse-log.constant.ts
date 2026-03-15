import { GrowthRuleTypeEnum } from '@libs/growth'

export enum BrowseLogTargetTypeEnum {
  /** 漫画作品 */
  COMIC = 1,
  /** 小说作品 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
  /** 论坛话题 */
  FORUM_TOPIC = 5,
}

/**
 * 浏览日志目标类型到成长规则类型的映射
 */
export const BROWSE_LOG_GROWTH_RULE_TYPE_MAP: Record<
  BrowseLogTargetTypeEnum,
  GrowthRuleTypeEnum | undefined
> = {
  [BrowseLogTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
  [BrowseLogTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_VIEW,
  [BrowseLogTargetTypeEnum.COMIC_CHAPTER]: undefined, // 章节浏览暂无额外奖励，由作品侧统一处理或预留
  [BrowseLogTargetTypeEnum.NOVEL_CHAPTER]: undefined,
  [BrowseLogTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_VIEW,
}
