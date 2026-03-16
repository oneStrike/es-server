import type { InteractionTx } from '../../interaction-tx.type'
import type { CommentTargetTypeEnum } from '../comment.constant'

/**
 * 评论目标元信息
 * 用于在评论创建后执行副作用（如发送通知）
 */
export interface CommentTargetMeta {
  /** 目标所有者用户ID，用于发送被评论通知 */
  ownerUserId?: number
}

/**
 * 评论目标解析器接口
 * 定义各类型评论目标需要实现的校验和解析方法
 */
export interface ICommentTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: CommentTargetTypeEnum

  /**
   * 校验是否允许对该目标发表评论
   * 检查目标是否存在、是否已被删除、是否允许评论（如作品禁评、帖子锁定等）
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @throws 当不允许评论时抛出 BadRequestException
   */
  ensureCanComment: (
    tx: InteractionTx,
    targetId: number,
  ) => Promise<void>

  /**
   * 应用评论计数增量
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  applyCountDelta: (
    tx: InteractionTx,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 解析目标元信息
   * 获取用于后置处理（如通知、计分）的必要数据
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @returns 目标元信息
   */
  resolveMeta: (
    tx: InteractionTx,
    targetId: number,
  ) => Promise<CommentTargetMeta>

  /**
   * 评论成功后钩子（可选）
   * 在事务内执行，可用于触发自定义后置逻辑
   *
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @param actorUserId - 执行评论的用户ID
   * @param meta - 目标元信息
   */
  postCommentHook?: (
    tx: InteractionTx,
    targetId: number,
    actorUserId: number,
    meta: CommentTargetMeta,
  ) => Promise<void>
}
