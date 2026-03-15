import { GrowthRuleTypeEnum } from '@libs/growth'
import { InteractionTargetTypeEnum } from '@libs/platform/constant'

/**
 * Growth action type used by interaction modules.
 * We keep it explicit to avoid passing arbitrary strings.
 */
export type InteractionGrowthAction = 'like' | 'favorite' | 'view'

/**
 * Shared growth rule mapping by action and target type.
 *
 * Notes:
 * - COMMENT is handled separately in LikeGrowthService (reward to comment author).
 * - Chapter favorite/view currently have no growth rule, so they are omitted.
 */
const INTERACTION_GROWTH_RULE_MAP: Record<
  InteractionGrowthAction,
  Partial<Record<InteractionTargetTypeEnum, GrowthRuleTypeEnum>>
> = {
  like: {
    [InteractionTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_LIKE,
    [InteractionTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_LIKE,
    [InteractionTargetTypeEnum.COMIC_CHAPTER]:
      GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
    [InteractionTargetTypeEnum.NOVEL_CHAPTER]:
      GrowthRuleTypeEnum.COMIC_CHAPTER_LIKE,
    [InteractionTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_LIKED,
  },
  favorite: {
    [InteractionTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_FAVORITE,
    [InteractionTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_FAVORITE,
    [InteractionTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_FAVORITED,
  },
  view: {
    [InteractionTargetTypeEnum.COMIC]: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
    [InteractionTargetTypeEnum.NOVEL]: GrowthRuleTypeEnum.NOVEL_WORK_VIEW,
    [InteractionTargetTypeEnum.FORUM_TOPIC]: GrowthRuleTypeEnum.TOPIC_VIEW,
  },
}

/**
 * Resolve growth rule by action + target type.
 * Returns null when the pair has no growth reward rule.
 */
export function resolveInteractionGrowthRuleType(
  action: InteractionGrowthAction,
  targetType: InteractionTargetTypeEnum,
): GrowthRuleTypeEnum | null {
  return INTERACTION_GROWTH_RULE_MAP[action][targetType] ?? null
}
