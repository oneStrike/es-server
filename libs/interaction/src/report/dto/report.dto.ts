import type { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import {
  ReportReasonEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from '../report.constant'

/**
 * 举报目标 DTO
 */
class ReportTargetDto {
  @NumberProperty({
    description: '举报的目标id',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description: '举报目标类型',
    enum: ReportTargetTypeEnum,
    required: true,
  })
  targetType!: ReportTargetTypeEnum
}

/**
 * 创建举报入参。
 */
export class CreateReportInputDto extends ReportTargetDto {
  @NumberProperty({
    description: '举报人ID',
    required: true,
  })
  reporterId!: number

  @EnumProperty({
    description: '举报原因类型',
    enum: ReportReasonEnum,
    required: true,
  })
  reasonType!: ReportReasonEnum

  @StringProperty({
    description: '详细说明',
    required: false,
  })
  description?: string

  @StringProperty({
    description: '证据图片URL',
    required: false,
  })
  evidenceUrl?: string
}

/**
 * 创建举报记录的完整数据结构。
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
