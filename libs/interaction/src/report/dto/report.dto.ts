import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
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

export class ReportTargetDto extends PickType(BaseReportDto, [
  'targetId',
  'targetType',
] as const) {}

export class ReportReasonBodyDto extends PickType(BaseReportDto, [
  'reasonType',
  'description',
  'evidenceUrl',
] as const) {}

export class CreateReportBodyDto extends IntersectionType(
  ReportTargetDto,
  ReportReasonBodyDto,
) {}

export class CreateReportCommandDto extends IntersectionType(
  CreateReportBodyDto,
  PickType(BaseReportDto, ['reporterId'] as const),
) {}

export class QueryMyReportPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseReportDto, [
      'targetType',
      'targetId',
      'reasonType',
      'status',
    ] as const),
  ),
) {}

export class QueryMyReportPageCommandDto extends IntersectionType(
  QueryMyReportPageDto,
  PickType(BaseReportDto, ['reporterId'] as const),
) {}

export class QueryAdminReportPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseReportDto, [
      'id',
      'reporterId',
      'handlerId',
      'targetType',
      'targetId',
      'sceneType',
      'sceneId',
      'reasonType',
      'status',
    ] as const),
  ),
) {}

const AdminHandleReportStatusEnum = {
  RESOLVED: ReportStatusEnum.RESOLVED,
  REJECTED: ReportStatusEnum.REJECTED,
} as const

export class HandleAdminReportDto extends IdDto {
  @EnumProperty({
    description: '裁决结果，仅允许已解决或已驳回',
    enum: AdminHandleReportStatusEnum,
    example: ReportStatusEnum.RESOLVED,
  })
  status!: ReportStatusEnum.RESOLVED | ReportStatusEnum.REJECTED

  @StringProperty({
    description: '处理备注',
    example: '证据充分，裁决为有效举报',
    required: false,
    maxLength: 500,
  })
  handlingNote?: string
}

export class HandleAdminReportCommandDto extends IntersectionType(
  HandleAdminReportDto,
  PickType(BaseReportDto, ['handlerId'] as const),
) {}
