import type { InteractionTx } from '../../interaction-tx.type'
import type { PurchaseTargetTypeEnum } from '../purchase.constant'

/**
 * 购买目标解析器接口
 */
export interface IPurchaseTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: PurchaseTargetTypeEnum

  /**
   * 检查购买目标是否满足购买条件 (如状态、价格等)
   * @param targetId - 目标 ID
   * @returns 价格等必要信息
   */
  ensurePurchaseable: (
    targetId: number,
  ) => Promise<{ price: number }>

  /**
   * 更新目标的购买统计数
   */
  applyCountDelta: (
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) => Promise<void>
}
