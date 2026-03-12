import type { CommentLevelEnum, SceneTypeEnum } from '@libs/base/constant'
import type { PrismaTransactionClientType } from '@libs/base/database'
import type { LikeTargetTypeEnum } from '../like.constant'

export interface LikeTargetMeta {
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum
}

export interface ILikeTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: LikeTargetTypeEnum

  /**
   * 检查目标是否存在，并解析点赞所需的场景元信息
   */
  resolveMeta: (
    tx: PrismaTransactionClientType,
    targetId: number,
  ) => Promise<LikeTargetMeta>

  /**
   * 更新目标的点赞统计数
   */
  applyCountDelta: (
    tx: PrismaTransactionClientType,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 点赞成功后的钩子（事务内执行）
   */
  postLikeHook?: (
    tx: PrismaTransactionClientType,
    targetId: number,
    actorUserId: number,
    meta: LikeTargetMeta,
  ) => Promise<void>

  /**
   * 批量获取目标详情（用于列表聚合展示）
   */
  batchGetDetails?: (targetIds: number[]) => Promise<Map<number, any>>
}
