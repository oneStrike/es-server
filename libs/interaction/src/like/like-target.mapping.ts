import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { LikeTargetTypeEnum } from './like.constant'

/**
 * 点赞模块本地目标类型到系统级交互目标语义的映射。
 */
export const LIKE_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Record<
  LikeTargetTypeEnum,
  InteractionTargetTypeEnum
> = {
  [LikeTargetTypeEnum.WORK_COMIC]: InteractionTargetTypeEnum.COMIC,
  [LikeTargetTypeEnum.WORK_NOVEL]: InteractionTargetTypeEnum.NOVEL,
  [LikeTargetTypeEnum.FORUM_TOPIC]: InteractionTargetTypeEnum.FORUM_TOPIC,
  [LikeTargetTypeEnum.WORK_COMIC_CHAPTER]:
    InteractionTargetTypeEnum.COMIC_CHAPTER,
  [LikeTargetTypeEnum.WORK_NOVEL_CHAPTER]:
    InteractionTargetTypeEnum.NOVEL_CHAPTER,
  [LikeTargetTypeEnum.COMMENT]: InteractionTargetTypeEnum.COMMENT,
}

export function mapLikeTargetTypeToInteractionTargetType(
  targetType: LikeTargetTypeEnum,
): InteractionTargetTypeEnum {
  return LIKE_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType]
}
