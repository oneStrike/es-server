import { ReportReasonEnum, ReportStatusEnum, ReportTargetTypeEnum } from '@libs/base/constant'
import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { ForumReportTypeEnum } from '../forum-report.constant'

export class BaseForumReportDto extends BaseDto {
  @NumberProperty({
    description: '举报人用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  reporterId!: number

  @EnumProperty({
    description: '举报类型（topic=主题, reply=回复, user=用户）',
    example: ForumReportTypeEnum.TOPIC,
    required: true,
    enum: ForumReportTypeEnum,
  })
  type!: ForumReportTypeEnum

  @EnumProperty({
    description: '统一举报目标类型',
    example: ReportTargetTypeEnum.FORUM_TOPIC,
    required: false,
    enum: ReportTargetTypeEnum,
  })
  targetType?: ReportTargetTypeEnum

  @NumberProperty({
    description: '举报目标ID（主题ID/回复ID/用户ID）',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @EnumProperty({
    description: '举报原因',
    example: ReportReasonEnum.INAPPROPRIATE_CONTENT,
    required: true,
    enum: ReportReasonEnum,
  })
  reason!: ReportReasonEnum

  @StringProperty({
    description: '举报详细说明',
    example: '该内容包含不当言论',
    required: false,
  })
  description?: string

  @StringProperty({
    description: '证据截图URL',
    example: 'https://example.com/evidence.png',
    required: false,
  })
  evidenceUrl?: string

  @EnumProperty({
    description: '处理状态',
    example: ReportStatusEnum.PENDING,
    required: false,
    enum: ReportStatusEnum,
  })
  status?: ReportStatusEnum

  @NumberProperty({
    description: '处理人ID',
    example: 1,
    required: false,
  })
  handlerId?: number

  @StringProperty({
    description: '处理结果说明',
    example: '已删除违规内容',
    required: false,
  })
  handlingNote?: string
}

export class CreateForumReportDto extends PickType(BaseForumReportDto, [
  'reporterId',
  'type',
  'targetType',
  'targetId',
  'reason',
  'description',
  'evidenceUrl',
]) {}

export class QueryForumReportDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumReportDto, ['type', 'targetType', 'reason', 'status', 'reporterId']),
  ),
) {}

export class UpdateForumReportStatusDto extends PickType(BaseForumReportDto, [
  'id',
  'status',
  'handlerId',
  'handlingNote',
]) {}

/**
 * 处理举报DTO
 * 用于管理员处理举报记录
 */
export class HandleForumReportDto extends IntersectionType(
  PickType(BaseForumReportDto, ['id']),
  PartialType(
    PickType(BaseForumReportDto, ['status', 'handlerId', 'handlingNote']),
  ),
) {}
