import type { CommentLevelEnum, SceneTypeEnum } from '@libs/base/constant'
import type { ReportReasonEnum, ReportStatusEnum, ReportTargetTypeEnum } from '../report.constant'

/**
 * 创建举报入参。
 *
 * 说明：
 * - 该结构表示 service 层收到的原始举报请求
 * - `sceneType` 等派生字段由目标解析器补齐，不要求调用方传入
 */
export interface CreateReportInputDto {
  reporterId: number
  targetType: ReportTargetTypeEnum
  targetId: number
  reasonType: ReportReasonEnum
  description?: string
  evidenceUrl?: string
}

/**
 * 创建举报记录的完整数据结构。
 *
 * 说明：
 * - 该结构表示落库前的最终数据
 * - `sceneType`、`sceneId`、`commentLevel` 均为服务内部解析结果
 */
export interface CreateUserReportDto extends CreateReportInputDto {
  sceneType: SceneTypeEnum
  sceneId: number
  commentLevel?: CommentLevelEnum
  status?: ReportStatusEnum
  handlerId?: number
  handlingNote?: string
}

/**
 * 创建举报可选项。
 */
export interface CreateUserReportOptions {
  duplicateMessage?: string
}
