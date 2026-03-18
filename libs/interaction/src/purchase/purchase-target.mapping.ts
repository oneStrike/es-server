import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { PurchaseTargetTypeEnum } from './purchase.constant'

/**
 * 购买模块本地目标类型到系统级交互目标语义的映射。
 */
export const PURCHASE_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Record<
  PurchaseTargetTypeEnum,
  InteractionTargetTypeEnum
> = {
  [PurchaseTargetTypeEnum.COMIC_CHAPTER]:
    InteractionTargetTypeEnum.COMIC_CHAPTER,
  [PurchaseTargetTypeEnum.NOVEL_CHAPTER]:
    InteractionTargetTypeEnum.NOVEL_CHAPTER,
}

export function mapPurchaseTargetTypeToInteractionTargetType(
  targetType: PurchaseTargetTypeEnum,
): InteractionTargetTypeEnum {
  return PURCHASE_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType]
}
