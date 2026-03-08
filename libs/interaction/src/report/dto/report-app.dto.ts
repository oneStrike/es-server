import { ReportReasonEnum, ReportTargetTypeEnum } from '@libs/base/constant'
import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { IntersectionType, OmitType } from '@nestjs/swagger'
import { IsIn, IsOptional } from 'class-validator'

// ============ 基础 DTO ============

/**
 * 举报请求体基类
 */
export class BaseReportBodyDto {
  @NumberProperty({
    description: '举报目标 ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description: '举报原因',
    enum: ReportReasonEnum,
    example: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
  })
  reason!: ReportReasonEnum

  @StringProperty({
    description: '举报说明',
    example: '该内容包含违规信息',
    required: false,
    maxLength: 500,
  })
  description?: string

  @StringProperty({
    description: '证据链接',
    example: 'https://example.com/evidence.png',
    required: false,
    maxLength: 500,
  })
  evidenceUrl?: string
}

// ============ 作品举报 DTO ============

/**
 * 创建作品举报请求（内部使用，包含 reporterId）
 */
export class CreateWorkReportDto {
  @NumberProperty({
    description: '举报人用户 ID',
    example: 1,
    required: true,
    min: 1,
    validation: false,
  })
  reporterId!: number

  @EnumProperty({
    description: '举报目标类型（作品/作品章节）',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.WORK,
    required: false,
  })
  @IsOptional()
  @IsIn([ReportTargetTypeEnum.WORK, ReportTargetTypeEnum.WORK_CHAPTER])
  targetType?: ReportTargetTypeEnum

  @NumberProperty({
    description: '举报目标 ID（作品 ID 或章节 ID）',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description: '举报原因',
    enum: ReportReasonEnum,
    example: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
  })
  reason!: ReportReasonEnum

  @StringProperty({
    description: '举报说明',
    example: '该内容包含违规信息',
    required: false,
    maxLength: 500,
  })
  description?: string

  @StringProperty({
    description: '证据链接',
    example: 'https://example.com/evidence.png',
    required: false,
    maxLength: 500,
  })
  evidenceUrl?: string
}

/**
 * 创建作品举报请求体（API 层使用，不包含 reporterId）
 * @deprecated 请使用 ReportWorkBodyDto
 */
export class CreateWorkReportBodyDto extends OmitType(CreateWorkReportDto, [
  'reporterId',
]) {}

/**
 * 举报作品请求体
 */
export class ReportWorkBodyDto extends BaseReportBodyDto {}

/**
 * 举报章节请求体
 */
export class ReportChapterBodyDto extends BaseReportBodyDto {}

// ============ 评论举报 DTO ============

/**
 * 评论 ID DTO
 */
class CommentIdDto {
  @NumberProperty({
    description: '评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number
}

/**
 * 举报信息基类
 */
class ReportReasonDto {
  @EnumProperty({
    description: '举报原因',
    enum: ReportReasonEnum,
    example: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
  })
  reason!: ReportReasonEnum

  @StringProperty({
    description: '举报说明',
    example: '该内容包含违规信息',
    required: false,
    maxLength: 500,
  })
  description?: string

  @StringProperty({
    description: '证据链接',
    example: 'https://example.com/evidence.png',
    required: false,
    maxLength: 500,
  })
  evidenceUrl?: string
}

/**
 * 举报评论请求体（使用 commentId 字段）
 */
export class ReportCommentBodyDto extends IntersectionType(
  CommentIdDto,
  ReportReasonDto,
) {}

// ============ 用户举报 DTO ============

/**
 * 举报用户请求体
 */
export class ReportUserBodyDto extends BaseReportBodyDto {}

// ============ 论坛举报 DTO ============

/**
 * 举报论坛主题请求体
 */
export class ReportForumTopicBodyDto extends BaseReportBodyDto {}

/**
 * 举报论坛回复请求体
 */
export class ReportForumReplyBodyDto extends BaseReportBodyDto {}
