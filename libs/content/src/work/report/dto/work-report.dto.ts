import {
  ReportReasonEnum,
  ReportStatusEnum,
  ReportTargetTypeEnum,
} from '@libs/base/constant'
import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'

export class BaseWorkReportDto extends BaseDto {
  @NumberProperty({
    description: '举报人用户 ID',
    example: 1,
    required: true,
    min: 1,
  })
  reporterId!: number

  @EnumProperty({
    description: '举报目标类型（作品/章节）',
    enum: ReportTargetTypeEnum,
    example: ReportTargetTypeEnum.WORK,
    required: false,
  })
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

  @EnumProperty({
    description: '处理状态',
    enum: ReportStatusEnum,
    example: ReportStatusEnum.PENDING,
    required: false,
  })
  status?: ReportStatusEnum

  @NumberProperty({
    description: '处理人 ID',
    example: 1,
    required: false,
    min: 1,
  })
  handlerId?: number

  @StringProperty({
    description: '处理备注',
    example: '已完成处理',
    required: false,
    maxLength: 500,
  })
  handlingNote?: string
}

export class CreateWorkReportDto extends PickType(BaseWorkReportDto, [
  'reporterId',
  'targetType',
  'targetId',
  'reason',
  'description',
  'evidenceUrl',
]) {}

export class CreateWorkReportBodyDto extends OmitType(CreateWorkReportDto, [
  'reporterId',
]) {}

export class QueryWorkReportDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseWorkReportDto, [
      'targetType',
      'reason',
      'status',
      'reporterId',
    ]),
  ),
) {}

export class HandleWorkReportDto extends IntersectionType(
  PickType(BaseWorkReportDto, ['id']),
  PartialType(
    PickType(BaseWorkReportDto, ['status', 'handlerId', 'handlingNote']),
  ),
) {}
