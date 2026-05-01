import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'

import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  InteractionActorSummaryDto,
  InteractionAppUserSummaryDto,
  InteractionReportCommentSummaryDto,
  InteractionReportTargetSummaryDto,
  InteractionSceneSummaryDto,
} from '../../summary/dto/interaction-summary.dto'
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
    description:
      '举报目标类型（1=漫画；2=小说；3=漫画章节；4=小说章节；5=论坛主题；6=评论；7=用户）',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMIC,
    required: true,
  })
  targetType!: ReportTargetTypeEnum

  @EnumProperty({
    description:
      '业务场景类型（1=漫画作品；2=小说作品；3=论坛主题；10=漫画章节；11=小说章节；12=用户主页）',
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
    description: '评论层级（1=根评论；2=回复评论）',
    enum: CommentLevelEnum,
    example: CommentLevelEnum.ROOT,
    required: false,
  })
  commentLevel?: CommentLevelEnum | null

  @EnumProperty({
    description:
      '举报原因类型（1=垃圾信息；2=不当内容；3=骚扰；4=版权侵权；99=其他）',
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
    description: '举报状态（1=待处理；2=处理中；3=已解决；4=已驳回）',
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
    description: '裁决结果（3=已解决；4=已驳回）',
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

class ReportTargetSceneSummaryFieldsDto {
  @NestedProperty({
    description: '举报目标展示摘要',
    required: false,
    nullable: true,
    type: InteractionReportTargetSummaryDto,
    validation: false,
  })
  targetSummary?: InteractionReportTargetSummaryDto | null

  @NestedProperty({
    description: '举报业务场景展示摘要',
    required: false,
    nullable: true,
    type: InteractionSceneSummaryDto,
    validation: false,
  })
  sceneSummary?: InteractionSceneSummaryDto | null
}

class ReportCommentSummaryFieldDto {
  @NestedProperty({
    description: '被举报评论展示摘要；仅举报目标为评论时返回',
    required: false,
    nullable: true,
    type: InteractionReportCommentSummaryDto,
    validation: false,
  })
  commentSummary?: InteractionReportCommentSummaryDto | null
}

class AdminReportActorSummaryFieldsDto {
  @NestedProperty({
    description: '举报人展示摘要',
    required: false,
    nullable: true,
    type: InteractionAppUserSummaryDto,
    validation: false,
  })
  reporterSummary?: InteractionAppUserSummaryDto | null

  @NestedProperty({
    description: '处理人展示摘要',
    required: false,
    nullable: true,
    type: InteractionActorSummaryDto,
    validation: false,
  })
  handlerSummary?: InteractionActorSummaryDto | null
}

class AdminReportPageSummaryFieldsDto extends IntersectionType(
  AdminReportActorSummaryFieldsDto,
  ReportTargetSceneSummaryFieldsDto,
) {}

class AdminReportDetailSummaryFieldsDto extends IntersectionType(
  AdminReportPageSummaryFieldsDto,
  ReportCommentSummaryFieldDto,
) {}

export class MyReportPageItemDto extends IntersectionType(
  BaseReportDto,
  ReportTargetSceneSummaryFieldsDto,
) {}

export class MyReportDetailDto extends IntersectionType(
  MyReportPageItemDto,
  ReportCommentSummaryFieldDto,
) {}

export class AdminReportPageItemDto extends IntersectionType(
  BaseReportDto,
  AdminReportPageSummaryFieldsDto,
) {}

export class AdminReportDetailDto extends IntersectionType(
  BaseReportDto,
  AdminReportDetailSummaryFieldsDto,
) {}
