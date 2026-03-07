import { ReportTargetTypeEnum } from '@libs/base/constant'
import {
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  ApiProperty,
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { IsIn, IsString } from 'class-validator'
import { ReportStatusEnum } from '../../common.constant'
import { CommentIdDto } from './comment.dto'

export class BaseReportInfoDto {
  @StringProperty({
    description: '举报原因',
    example: 'spam',
    required: true,
    minLength: 1,
    maxLength: 50,
  })
  reason!: string

  @StringProperty({
    description: '举报描述',
    example: '包含垃圾内容',
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

export class ReportHandlingDto {
  @StringProperty({
    description: '处理备注',
    example: 'handled',
    required: false,
    maxLength: 500,
  })
  handlingNote?: string

  @DateProperty({
    description: '处理时间',
    example: '2026-03-04T09:00:00.000Z',
    required: false,
  })
  handledAt?: Date
}

export class BaseCommentReportDto extends BaseDto {
  @EnumProperty({
    description: '举报目标类型（统一举报表字段）',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.COMMENT,
    required: false,
  })
  targetType?: ReportTargetTypeEnum

  @NumberProperty({
    description: '举报目标ID（统一举报表字段）',
    example: 1,
    required: false,
    min: 1,
  })
  targetId?: number

  @NumberProperty({
    description: '评论ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number

  @NumberProperty({
    description: '举报用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  reporterId!: number

  @StringProperty({
    description: '举报原因',
    example: 'spam',
    required: true,
    minLength: 1,
    maxLength: 50,
  })
  reason!: string

  @StringProperty({
    description: '举报描述',
    example: '包含垃圾内容',
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

  @EnumProperty({
    description: '举报状态',
    enum: ReportStatusEnum,
    example: ReportStatusEnum.PENDING,
    required: true,
  })
  status!: ReportStatusEnum

  @NumberProperty({
    description: '处理人用户ID',
    example: 1,
    required: false,
    min: 1,
  })
  handlerId?: number

  @StringProperty({
    description: '处理备注',
    example: 'handled',
    required: false,
    maxLength: 500,
  })
  handlingNote?: string

  @DateProperty({
    description: '处理时间',
    example: '2026-03-04T09:00:00.000Z',
    required: false,
  })
  handledAt?: Date
}

export class ReportIdDto {
  @NumberProperty({ description: '举报ID', example: 1, required: true, min: 1 })
  reportId!: number
}

export class ReportCommentDto extends IntersectionType(
  CommentIdDto,
  BaseReportInfoDto,
) {
  @NumberProperty({
    description: '举报用户ID',
    example: 1,
    required: true,
    min: 1,
    validation: false,
  })
  reporterId!: number
}

export class ReportCommentBodyDto extends IntersectionType(
  CommentIdDto,
  BaseReportInfoDto,
) {}

export class QueryCommentReportDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseCommentReportDto), ['status']),
) {}

export class HandleCommentReportDto extends IntersectionType(
  ReportIdDto,
  ReportHandlingDto,
) {
  @ApiProperty({
    description: '处理状态',
    enum: [ReportStatusEnum.RESOLVED, ReportStatusEnum.REJECTED],
    example: ReportStatusEnum.RESOLVED,
  })
  @IsString()
  @IsIn([ReportStatusEnum.RESOLVED, ReportStatusEnum.REJECTED])
  status!: ReportStatusEnum.RESOLVED | ReportStatusEnum.REJECTED
}
