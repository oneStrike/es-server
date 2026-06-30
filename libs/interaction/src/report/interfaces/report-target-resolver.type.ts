import type { Db } from '@db/core'
import type { EventEnvelope } from '@libs/growth/event-definition/event-envelope.type'
import type { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import type { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import type { JsonObject } from '@libs/platform/utils'
import type {
  ReportDispositionActionEnum,
  ReportTargetTypeEnum,
} from '../report.constant'

export interface ReportDispositionResult {
  applied: boolean
  statusBefore?: JsonObject
  statusAfter?: JsonObject
  message: string
  eventEnvelope?: EventEnvelope<GrowthRuleTypeEnum> | null
  rewardComment?: unknown
}

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
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @returns 目标元信息
   * @throws 目标不存在时抛出异常
   */
  resolveMeta: (tx: Db, targetId: number) => Promise<ReportTargetMeta>

  /**
   * 举报成功后钩子（可选）
   * 在事务内执行，可用于触发通知、审核等后置逻辑
   * @param tx - 事务客户端
   * @param targetId - 目标ID
   * @param reporterId - 举报人ID
   * @param meta - 目标元信息
   */
  postReportHook?: (
    tx: Db,
    targetId: number,
    reporterId: number,
    meta: ReportTargetMeta,
  ) => Promise<void>

  /**
   * 在举报最终裁决事务内执行目标处置。
   * 实现方必须调用自身 owner service 的 InTx 入口，不能在这里开启独立事务。
   */
  applyDisposition?: (
    tx: Db,
    input: {
      reportId: number
      targetId: number
      action: ReportDispositionActionEnum
      reason?: string | null
      actorUserId: number
    },
  ) => Promise<ReportDispositionResult>

  /**
   * 举报最终事务提交后执行的 owner 副作用，例如评论成长奖励补发。
   */
  postDispositionCommit?: (result: ReportDispositionResult) => Promise<void>
}
