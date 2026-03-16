import type { InteractionTx } from '../../interaction-tx.type'
import type { FavoriteTargetTypeEnum } from '../favorite.constant'

export interface IFavoriteTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: FavoriteTargetTypeEnum

  /**
   * 检查目标是否存在，并返回必要的属主信息（例如用于发通知）
   * @param tx Prisma 事务对象
   * @param targetId 目标 ID
   * @returns 属主 UserId（如果需要发通知）
   * @throws BadRequestException 如果目标不存在
   */
  ensureExists: (
    tx: InteractionTx,
    targetId: number,
  ) => Promise<{ ownerUserId?: number }>

  /**
   * 更新目标的收藏统计数
   * @param tx Prisma 事务对象
   * @param targetId 目标 ID
   * @param delta 增量 (+1 或 -1)
   */
  applyCountDelta: (
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 收藏成功的后续钩子（在事务内执行，主要用于发送入库消息）
   */
  postFavoriteHook?: (
    tx: InteractionTx,
    targetId: number,
    actorUserId: number,
    options: { ownerUserId?: number },
  ) => Promise<void>

  /**
   * (可选) 批量获取目标的详情信息，用于在 getUserFavorites 列表中进行数据聚合展示
   * @param targetIds 目标 ID 列表
   * @returns 目标 ID 与对应实体详情的映射
   */
  batchGetDetails?: (targetIds: number[]) => Promise<Map<number, any>>
}
