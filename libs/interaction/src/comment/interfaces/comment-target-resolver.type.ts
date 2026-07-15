import type { DbExecutor } from '@db/core'
import type { BodyDoc } from '@libs/interaction/body/body.type'
import type { AuditStatusEnum } from '@libs/platform/constant'
import type { CommentTargetTypeEnum } from '../comment.constant'

/**
 * 评论目标元信息
 * 用于在评论创建后执行副作用（如发送通知）
 */
export interface CommentTargetMeta {
  /** 目标所有者用户ID，用于发送被评论通知 */
  ownerUserId?: number
  /** 论坛主题所属板块ID，仅 forum topic 等场景使用 */
  sectionId?: number
  /** 目标展示标题，用于回复通知正文兜底等场景 */
  targetDisplayTitle?: string
}

/**
 * 评论目标 hook 载荷。
 * 统一复用首次可见与删除回退场景下的评论快照字段，避免各 resolver 再维护一套平行参数。
 */
export interface CommentTargetHookPayload {
  id: number
  userId: number
  targetType: CommentTargetTypeEnum
  targetId: number
  replyToId: number | null
  content?: string
  createdAt: Date
  replyTargetUserId?: number
}

/**
 * 评论正文物化输入。
 * - target owner 只能在调用方已开启的事务中改写 canonical BodyDoc。
 * - 不承载 target 专有的任意上下文，避免把跨域副作用重新藏回 interaction。
 */
export interface CommentTargetBodyMaterializationInput {
  tx: DbExecutor
  body: BodyDoc
  actorUserId: number
}

/**
 * 评论持久化后的目标事实。
 * - body 已完成 target materialization，但尚未由 interaction 编译并写入回复/通知副作用。
 * - isVisible 是评论自身可见性，不包含 target 父对象的可见性。
 */
export interface CommentTargetPersistedCommentPayload extends CommentTargetHookPayload {
  content: string
  body: BodyDoc
  auditStatus: AuditStatusEnum
  isHidden: boolean
  isVisible: boolean
}

/**
 * 评论治理状态变更后的目标事实。
 * 目标 owner 据此同步自身派生事实；无论评论可见性是否改变都必须调用。
 */
export interface CommentTargetVisibilitySyncPayload {
  id: number
  targetType: CommentTargetTypeEnum
  targetId: number
  auditStatus: AuditStatusEnum
  isHidden: boolean
  isVisible: boolean
}

/**
 * 评论删除范围。
 * 同一删除事务内的所有评论均属于同一 target，目标 owner 必须无条件清理其派生事实。
 */
export interface CommentTargetDeletionPayload {
  targetType: CommentTargetTypeEnum
  targetId: number
  commentIds: number[]
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
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @throws 当不允许评论时抛出 BadRequestException
   */
  ensureCanComment: (tx: DbExecutor, targetId: number) => Promise<void>

  /**
   * 校验当前行为人对目标的专有访问权限。
   * 在目标已锁定并完成通用可评论校验的同一事务内执行。
   */
  ensureActorCanComment?: (
    tx: DbExecutor,
    targetId: number,
    actorUserId: number,
  ) => Promise<void>

  /**
   * 对已解析的 canonical 正文执行目标专有物化。
   * 返回值仍是 interaction owner 的 BodyDoc，随后由 CommentService 统一编译与渲染。
   */
  materializeCommentBodyInTx?: (
    input: CommentTargetBodyMaterializationInput,
  ) => Promise<BodyDoc>

  /**
   * 应用评论计数增量
   *
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @param delta - 变更量（+1 增加，-1 减少）
   */
  applyCountDelta: (
    tx: DbExecutor,
    targetId: number,
    delta: number,
  ) => Promise<void>

  /**
   * 解析目标元信息
   * 获取用于后置处理（如通知、计分）的必要数据
   *
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @returns 目标元信息
   */
  resolveMeta: (tx: DbExecutor, targetId: number) => Promise<CommentTargetMeta>

  /**
   * 评论成功后钩子（可选）
   * 在事务内执行，可用于触发自定义后置逻辑与一级评论通知
   *
   * @param tx - 事务客户端
   * @param comment - 首次变为可见的评论载荷
   * @param meta - 目标元信息
   */
  postCommentHook?: (
    tx: DbExecutor,
    comment: CommentTargetHookPayload & { content: string },
    meta: CommentTargetMeta,
  ) => Promise<void>

  /**
   * 新评论写入后的目标事实 hook。
   * 在同一事务中执行，适合写 target owner 的引用或索引事实。
   */
  postPersistedCommentHook?: (
    tx: DbExecutor,
    comment: CommentTargetPersistedCommentPayload,
    meta: CommentTargetMeta,
  ) => Promise<void>

  /**
   * 评论审核或隐藏状态变更后的目标事实同步。
   * 即使前后评论自身可见性相同也会执行。
   */
  syncCommentVisibilityHook?: (
    tx: DbExecutor,
    comment: CommentTargetVisibilitySyncPayload,
  ) => Promise<void>

  /**
   * 评论软删除后的目标事实清理。
   * 无论被删评论是否对外可见都在同一事务中执行。
   */
  deleteCommentsHook?: (
    tx: DbExecutor,
    payload: CommentTargetDeletionPayload,
  ) => Promise<void>

  /**
   * 读取目标作者，用于“仅作者评论”筛选与作者标记。
   * 目标不存在时返回 undefined，不改变评论读路径的既有空结果语义。
   */
  resolveTargetAuthorUserId?: (targetId: number) => Promise<number | undefined>

  /**
   * 可见评论删除后的钩子（可选）
   * 在事务内执行，可用于同步回复计数、最后回复时间等派生字段
   */
  postDeleteCommentHook?: (
    tx: DbExecutor,
    comment: CommentTargetHookPayload,
    meta: CommentTargetMeta,
  ) => Promise<void>
}
