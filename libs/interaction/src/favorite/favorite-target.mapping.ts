import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { FavoriteTargetTypeEnum } from './favorite.constant'

/**
 * 收藏模块本地目标类型到系统级交互目标语义的映射。
 */
export const FAVORITE_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Record<
  FavoriteTargetTypeEnum,
  InteractionTargetTypeEnum
> = {
  [FavoriteTargetTypeEnum.WORK_COMIC]: InteractionTargetTypeEnum.COMIC,
  [FavoriteTargetTypeEnum.WORK_NOVEL]: InteractionTargetTypeEnum.NOVEL,
  [FavoriteTargetTypeEnum.FORUM_TOPIC]: InteractionTargetTypeEnum.FORUM_TOPIC,
}

export function mapFavoriteTargetTypeToInteractionTargetType(
  targetType: FavoriteTargetTypeEnum,
): InteractionTargetTypeEnum {
  return FAVORITE_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType]
}
