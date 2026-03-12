import type { CommentLevelEnum, SceneTypeEnum } from '@libs/base/constant'
import type { ReportTargetTypeEnum } from '../report.constant'
import type { PrismaTransactionClientType } from '@libs/base/database'

/**
 * 举报目标元信息
 * 包含举报目标所属的场景信息和所有者信息
 */
export interface ReportTargetMeta {
  /** 场景类型（如漫画、小说等） */
  sceneType: SceneTypeEnum
  /** 场景ID */
  sceneId: number
  /** 评论层级（仅评论类型有效） */
  commentLevel?: CommentLevelEnum
  /** 目标所有者用户ID（用于拦截自举报） */
  ownerUserId?: number
}

/**
 * 举报目标解析器接口
 * 定义各类型举报目标需要实现的解析方法
 * 用于解耦举报服务与具体业务模块
 */
export interface IReportTargetResolver {
  /**
   * 目标类型标识
   */
  readonly targetType: ReportTargetTypeEnum

  /**
   * 解析目标元信息
   * 检查目标是否存在，并返回举报所需的场景元信息
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @returns 目标元信息
   * @throws 目标不存在时抛出异常
   */
  resolveMeta: (
    tx: PrismaTransactionClientType,
    targetId: number,
  ) => Promise<ReportTargetMeta>

  /**
   * 举报成功后钩子（可选）
   * 在事务内执行，可用于触发通知、审核等后置逻辑
   * @param tx - Prisma 事务客户端
   * @param targetId - 目标ID
   * @param reporterId - 举报人ID
   * @param meta - 目标元信息
   */
  postReportHook?: (
    tx: PrismaTransactionClientType,
    targetId: number,
    reporterId: number,
    meta: ReportTargetMeta,
  ) => Promise<void>
}
