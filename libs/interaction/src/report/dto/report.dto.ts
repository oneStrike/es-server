import type { ReportReasonEnum, ReportStatusEnum, ReportTargetTypeEnum } from '@libs/base/constant'

export interface CreateUserReportDto {
  reporterId: number
  targetType: ReportTargetTypeEnum
  targetId: number
  reason: string
  description?: string
  evidenceUrl?: string
  status?: ReportStatusEnum
  handlerId?: number
  handlingNote?: string
}

export interface CreateUserReportOptions {
  duplicateMessage?: string
}

export interface CreateWorkSceneReportDto {
  reporterId: number
  targetType?: ReportTargetTypeEnum
  targetId: number
  reason: ReportReasonEnum
  description?: string
  evidenceUrl?: string
}

export interface CreateForumSceneReportDto {
  reporterId: number
  targetType: ReportTargetTypeEnum
  targetId: number
  reason: ReportReasonEnum
  description?: string
  evidenceUrl?: string
}
