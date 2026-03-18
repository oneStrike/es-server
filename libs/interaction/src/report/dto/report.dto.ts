import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import {
  ReportReasonEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from '../report.constant'

/**
 * 举报记录基础 DTO（全量字段）
 */
export class BaseReportDto extends BaseDto {
  @NumberProperty({
    description: '举报人 ID',
    example: 1,
    required: true,
  })
  reporterId!: number

  @NumberProperty({
    description: '处理人 ID',
    example: 1,
    required: false,
  })
  handlerId?: number | null

  @NumberProperty({
    description: '举报目标 ID',
    example: 1,
    required: true,
  })
  targetId!: number

  @EnumProperty({
    description: '举报目标类型',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: ReportTargetTypeEnum

  @EnumProperty({
    description: '业务场景类型',
    enum: SceneTypeEnum,
    example: SceneTypeEnum.COMIC_WORK,
    required: true,
  })
  sceneType!: SceneTypeEnum

  @NumberProperty({
    description: '业务场景根对象 ID',
    example: 1,
    required: true,
  })
  sceneId!: number

  @EnumProperty({
    description: '评论层级（仅评论目标有值）',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: false,
  })
  commentLevel?: CommentLevelEnum | null

  @EnumProperty({
    description: '举报原因类型',
    enum: ReportReasonEnum,
    example: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
  })
  reasonType!: ReportReasonEnum

  @StringProperty({
    description: '详细说明',
    required: false,
  })
  description?: string | null

  @StringProperty({
    description: '证据图片URL',
    example: 'https://example.com/evidence.png',
    required: false,
  })
  evidenceUrl?: string | null

  @EnumProperty({
    description: '举报状态',
    enum: ReportStatusEnum,
    example: ReportStatusEnum.PENDING,
    required: true,
  })
  status!: ReportStatusEnum

  @StringProperty({
    description: '处理备注',
    example: '已受理，待审核',
    required: false,
  })
  handlingNote?: string | null

  @DateProperty({
    description: '处理时间',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  handledAt?: Date | null
}
