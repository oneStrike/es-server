import { InteractionTargetTypeEnum } from '@libs/base/constant'
import { GrowthRuleTypeEnum } from '@libs/user/growth-rule.constant'

/**
 * 点赞类型映射 Growth 规则
 */
export const LIKE_GROWTH_RULE_TYPE_MAP: Partial<
  Record<InteractionTargetTypeEnum, GrowthRuleTypeEnum>
> = {
  [InteractionTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_LIKE,
  [InteractionTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_LIKE,
  [InteractionTargetTypeEnum.COMIC_CHAPTER]:
    GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
  [InteractionTargetTypeEnum.NOVEL_CHAPTER]:
    GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
  [InteractionTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_LIKED,
}
