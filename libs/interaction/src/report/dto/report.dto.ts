import { CommentLevelEnum, SceneTypeEnum } from '@libs/platform/constant'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'

import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  InteractionActorSummaryDto,
  InteractionAppUserSummaryDto,
  InteractionReportCommentSummaryDto,
  InteractionReportTargetSummaryDto,
  InteractionSceneSummaryDto,
} from '../../summary/dto/interaction-summary.dto'
import {
  ReportDispositionActionEnum,
  ReportDispositionStatusEnum,
  ReportDispositionStatusFilterEnum,
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
    nullable: true,
  })
  handlerId!: number | null

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
    nullable: true,
    validation: false,
  })
  commentLevel!: CommentLevelEnum | null

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
    nullable: true,
  })
  description!: string | null

  @StringProperty({
    description: '证据图片URL',
    example: 'https://example.com/evidence.png',
    nullable: true,
  })
  evidenceUrl!: string | null

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
    nullable: true,
  })
  handlingNote!: string | null

  @EnumProperty({
    description:
      '目标处置动作（1=无需处置；2=隐藏评论；3=拒绝评论；4=隐藏论坛主题；5=拒绝论坛主题；6=禁用用户；7=禁言用户）',
    enum: ReportDispositionActionEnum,
    example: ReportDispositionActionEnum.NO_ACTION_REQUIRED,
    required: true,
  })
  targetAction!: ReportDispositionActionEnum

  @StringProperty({
    description: '目标处置原因',
    example: '举报成立，评论违反社区规范',
    nullable: true,
    maxLength: 500,
  })
  targetActionReason!: string | null

  @EnumProperty({
    description:
      '目标处置状态（1=无需处置；2=已处置；3=历史已处理但无处置记录）',
    enum: ReportDispositionStatusEnum,
    example: ReportDispositionStatusEnum.APPLIED,
    required: true,
  })
  targetActionStatus!: ReportDispositionStatusEnum

  @ObjectProperty({
    description: '目标处置结构化结果',
    nullable: true,
    validation: false,
    example: {
      applied: true,
      statusBefore: false,
      statusAfter: true,
      message: '评论已隐藏',
    },
  })
  targetActionResult!: Record<string, unknown> | null

  @DateProperty({
    description: '目标处置完成时间',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
    validation: false,
  })
  targetActionAppliedAt!: Date | null

  @DateProperty({
    description: '处理时间',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
    validation: false,
  })
  handledAt!: Date | null
}

export class ReportTargetDto extends PickType(BaseReportDto, [
  'targetId',
  'targetType',
] as const) {}

export class ReportReasonBodyDto extends IntersectionType(
  PickType(BaseReportDto, ['reasonType'] as const),
  PartialType(PickType(BaseReportDto, ['description', 'evidenceUrl'] as const)),
) {}

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
      'targetActionStatus',
    ] as const),
  ),
) {
  @EnumProperty({
    description:
      '处置状态筛选（1=无需处置；2=处置成功；3=历史未处置；99=最新处置失败）',
    enum: ReportDispositionStatusFilterEnum,
    example: ReportDispositionStatusFilterEnum.APPLIED,
    required: false,
  })
  dispositionStatus?: ReportDispositionStatusFilterEnum

  @StringProperty({
    description: '创建日期开始（应用时区自然日，YYYY-MM-DD）',
    example: '2026-06-01',
    required: false,
  })
  declare startDate?: string

  @StringProperty({
    description: '创建日期结束（应用时区自然日，YYYY-MM-DD）',
    example: '2026-06-08',
    required: false,
  })
  declare endDate?: string
}

const AdminHandleReportStatusEnum = {
  RESOLVED: ReportStatusEnum.RESOLVED,
  REJECTED: ReportStatusEnum.REJECTED,
} as const

class HandleAdminReportStatusDto extends IdDto {
  @EnumProperty({
    description: '裁决结果（3=已解决；4=已驳回）',
    enum: AdminHandleReportStatusEnum,
    example: ReportStatusEnum.RESOLVED,
  })
  status!: ReportStatusEnum.RESOLVED | ReportStatusEnum.REJECTED
}

class HandleAdminReportSanctionFieldsDto {
  @NumberProperty({
    description: '用户处罚时长（分钟）；仅用户处罚动作可用',
    example: 1440,
    required: false,
    min: 1,
  })
  sanctionDurationMinutes?: number
}

export class HandleAdminReportDto extends IntersectionType(
  HandleAdminReportStatusDto,
  PickType(BaseReportDto, ['targetAction'] as const),
  PartialType(PickType(BaseReportDto, [
    'handlingNote',
    'targetActionReason',
  ] as const)),
  HandleAdminReportSanctionFieldsDto,
) {}

export class HandleAdminReportCommandDto extends IntersectionType(
  HandleAdminReportDto,
  PickType(BaseReportDto, ['handlerId'] as const),
) {}

class ReportTargetSceneSummaryFieldsDto {
  @NestedProperty({
    description: '举报目标展示摘要',
    nullable: true,
    type: InteractionReportTargetSummaryDto,
    validation: false,
  })
  targetSummary!: InteractionReportTargetSummaryDto | null

  @NestedProperty({
    description: '举报业务场景展示摘要',
    nullable: true,
    type: InteractionSceneSummaryDto,
    validation: false,
  })
  sceneSummary!: InteractionSceneSummaryDto | null
}

class ReportCommentSummaryFieldDto {
  @NestedProperty({
    description: '被举报评论展示摘要；仅举报目标为评论时返回',
    nullable: true,
    type: InteractionReportCommentSummaryDto,
    validation: false,
  })
  commentSummary!: InteractionReportCommentSummaryDto | null
}

class AdminReportActorSummaryFieldsDto {
  @NestedProperty({
    description: '举报人展示摘要',
    nullable: true,
    type: InteractionAppUserSummaryDto,
    validation: false,
  })
  reporterSummary!: InteractionAppUserSummaryDto | null

  @NestedProperty({
    description: '处理人展示摘要',
    nullable: true,
    type: InteractionActorSummaryDto,
    validation: false,
  })
  handlerSummary!: InteractionActorSummaryDto | null
}

export class ReportDispositionAttemptDto extends BaseDto {
  @NumberProperty({
    description: '举报 ID',
    example: 1,
    required: true,
    validation: false,
  })
  reportId!: number

  @EnumProperty({
    description:
      '目标处置动作（1=无需处置；2=隐藏评论；3=拒绝评论；4=隐藏论坛主题；5=拒绝论坛主题；6=禁用用户；7=禁言用户）',
    enum: ReportDispositionActionEnum,
    example: ReportDispositionActionEnum.HIDE_COMMENT,
    required: true,
    validation: false,
  })
  targetAction!: ReportDispositionActionEnum

  @StringProperty({
    description: '失败码',
    example: 'OWNER_DISPOSITION_FAILED',
    nullable: true,
    validation: false,
  })
  failureCode!: string | null

  @StringProperty({
    description: '失败信息',
    example: '评论状态已变化，请刷新后重试',
    nullable: true,
    validation: false,
  })
  failureMessage!: string | null

  @DateProperty({
    description: '尝试发生时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
    validation: false,
  })
  attemptedAt!: Date
}

class AdminReportDispositionAttemptFieldDto {
  @NestedProperty({
    description: '最新未解决处置失败记录',
    nullable: true,
    type: ReportDispositionAttemptDto,
    validation: false,
  })
  latestFailedDispositionAttempt!: ReportDispositionAttemptDto | null
}

class AdminReportPageSummaryFieldsDto extends IntersectionType(
  AdminReportActorSummaryFieldsDto,
  IntersectionType(
    ReportTargetSceneSummaryFieldsDto,
    AdminReportDispositionAttemptFieldDto,
  ),
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
