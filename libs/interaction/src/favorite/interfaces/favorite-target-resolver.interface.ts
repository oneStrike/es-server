import type { Db } from '@db/core'
import type { FavoriteTargetTypeEnum } from '../favorite.constant'

/**
 * 收藏目标上下文
 * 用于在收藏主链路与后置钩子之间透传属主与展示快照
 */
export interface FavoriteTargetContext {
  ownerUserId?: number
  targetTitle?: string
}

export interface IFavoriteTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: FavoriteTargetTypeEnum

  /**
   * 检查目标是否存在，并返回必要的属主信息（例如用于发通知）
   * @param tx 事务对象
   * @param targetId 目标 ID
   * @returns 属主 UserId（如果需要发通知）
   * @throws BadRequestException 如果目标不存在
   */
  ensureExists: (
    tx: Db,
    targetId: number,
  ) => Promise<FavoriteTargetContext>

  /**
   * 更新目标的收藏统计数
   * @param tx 事务对象
   * @param targetId 目标 ID
   * @param delta 增量 (+1 或 -1)
   */
  applyCountDelta: (
    tx: Db,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 收藏成功的后续钩子（在事务内执行，主要用于发送入库消息）
   */
  postFavoriteHook?: (
    tx: Db,
    targetId: number,
    actorUserId: number,
    options: FavoriteTargetContext,
  ) => Promise<void>

  /**
   * (可选) 批量获取目标的详情信息，用于在收藏分页接口中进行数据聚合展示
   * @param targetIds 目标 ID 列表
   * @param userId 当前用户 ID，用于补充用户态字段
   * @returns 目标 ID 与对应实体详情的映射
   */
  batchGetDetails?: (
    targetIds: number[],
    userId?: number,
  ) => Promise<Map<number, unknown>>
}
