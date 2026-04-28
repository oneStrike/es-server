import type { Db } from '@db/core'
import type { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant';
import type { LikeTargetTypeEnum } from '../like.constant'

/**
 * 点赞目标元信息
 * 包含点赞目标所属的场景信息
 */
export interface LikeTargetMeta {
  /** 场景类型（如漫画、小说等） */
  sceneType: SceneTypeEnum
  /** 场景ID */
  sceneId: number
  /** 评论层级（仅评论类型有效） */
  commentLevel?: CommentLevelEnum
  /** 目标所有者用户ID（可选，用于通知和自操作保护） */
  ownerUserId?: number
  /** 目标展示标题（可选，用于通知展示快照） */
  targetTitle?: string
}

/**
 * 点赞目标解析器接口
 * 定义各类型点赞目标需要实现的解析方法
 * 用于解耦点赞服务与具体业务模块
 */
export interface ILikeTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: LikeTargetTypeEnum

  /**
   * 解析目标元信息
   * 检查目标是否存在，并返回点赞所需的场景元信息
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @returns 目标元信息
   * @throws 目标不存在时抛出异常
   */
  resolveMeta: (tx: Db, targetId: number) => Promise<LikeTargetMeta>

  /**
   * 更新点赞计数
   * 在事务中更新目标的点赞统计数
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @param delta - 变化量（点赞+1，取消点赞-1）
   */
  applyCountDelta: (tx: Db, targetId: number, delta: number) => Promise<void>

  /**
   * 点赞成功后钩子（可选）
   * 在事务内执行，可用于触发通知等后置逻辑
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @param actorUserId - 执行点赞的用户ID
   * @param meta - 目标元信息
   */
  postLikeHook?: (
    tx: Db,
    targetId: number,
    actorUserId: number,
    meta: LikeTargetMeta,
  ) => Promise<void>

  /**
   * 取消点赞成功后钩子（可选）
   * 在事务内执行，可用于记录日志等回退后的附加副作用
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @param actorUserId - 执行取消点赞的用户ID
   */
  postUnlikeHook?: (
    tx: Db,
    targetId: number,
    actorUserId: number,
  ) => Promise<void>

  /**
   * 批量获取目标详情（可选）
   * 用于用户点赞列表聚合展示目标详情
   * @param targetIds - 目标ID数组
   * @returns 目标ID到详情的映射
   */
  batchGetDetails?: (targetIds: number[]) => Promise<Map<number, unknown>>
}
