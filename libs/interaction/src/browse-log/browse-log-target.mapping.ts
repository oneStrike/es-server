import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { BrowseLogTargetTypeEnum } from './browse-log.constant'

/**
 * 浏览模块本地目标类型到系统级交互目标语义的映射。
 */
export const BROWSE_LOG_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Record<
  BrowseLogTargetTypeEnum,
  InteractionTargetTypeEnum
> = {
  [BrowseLogTargetTypeEnum.COMIC]: InteractionTargetTypeEnum.COMIC,
  [BrowseLogTargetTypeEnum.NOVEL]: InteractionTargetTypeEnum.NOVEL,
  [BrowseLogTargetTypeEnum.COMIC_CHAPTER]:
    InteractionTargetTypeEnum.COMIC_CHAPTER,
  [BrowseLogTargetTypeEnum.NOVEL_CHAPTER]:
    InteractionTargetTypeEnum.NOVEL_CHAPTER,
  [BrowseLogTargetTypeEnum.FORUM_TOPIC]: InteractionTargetTypeEnum.FORUM_TOPIC,
}

export function mapBrowseLogTargetTypeToInteractionTargetType(
  targetType: BrowseLogTargetTypeEnum,
): InteractionTargetTypeEnum {
  return BROWSE_LOG_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType]
}
