import type { DbExecutor } from '@db/core'
import type { FollowTargetTypeEnum } from '../follow.type'

export interface IFollowTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: FollowTargetTypeEnum

  /**
   * 检查目标是否存在，并返回必要的属主信息
   * @param tx 事务对象
   * @param targetId 目标 ID
   * @param actorUserId 发起关注的用户 ID
   */
  ensureExists: (
    tx: DbExecutor,
    targetId: number,
    actorUserId: number,
  ) => Promise<{ ownerUserId?: number }>

  /**
   * 更新目标的关注统计数
   * @param tx 事务对象
   * @param targetId 目标 ID
   * @param delta 增量 (+1 或 -1)
   */
  applyCountDelta: (
    tx: DbExecutor,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 关注成功后的事务内钩子
   */
  postFollowHook?: (
    tx: DbExecutor,
    targetId: number,
    actorUserId: number,
    options: { ownerUserId?: number },
  ) => Promise<void>

  /**
   * 批量获取目标详情，用于关注列表聚合展示
   */
  batchGetDetails?: (
    targetIds: number[],
    userId?: number,
  ) => Promise<Map<number, unknown>>
}
