import { DateProperty, EnumProperty, NumberProperty, StringProperty } from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import { ApiProperty, IntersectionType, PartialType, PickType } from '@nestjs/swagger'

import { IsIn, IsString } from 'class-validator'
import { ReportStatus } from '../../interaction.constant'

export class BaseCommentReportDto extends BaseDto {
  @NumberProperty({
    description: 'Comment ID',
    example: 1,
    required: true,
    min: 1,
  })
  commentId!: number

  @NumberProperty({
    description: 'Reporter user ID',
    example: 1,
    required: true,
    min: 1,
  })
  reporterId!: number

  @StringProperty({
    description: 'Report reason',
    example: 'spam',
    required: true,
    minLength: 1,
  })
  reason!: string

  @StringProperty({
    description: 'Report description',
    example: 'Contains spam content',
    required: false,
  })
  description?: string

  @StringProperty({
    description: 'Evidence URL',
    example: 'https://example.com/evidence.png',
    required: false,
  })
  evidenceUrl?: string

  @EnumProperty({
    description: 'Report status',
    enum: ReportStatus,
    example: ReportStatus.PENDING,
    required: true,
  })
  status!: ReportStatus

  @NumberProperty({
    description: 'Handler user ID',
    example: 1,
    required: false,
    min: 1,
  })
  handlerId?: number

  @StringProperty({
    description: 'Handling note',
    example: 'handled',
    required: false,
    maxLength: 500,
  })
  handlingNote?: string

  @DateProperty({
    description: 'Handled at',
    example: '2026-03-04T09:00:00.000Z',
    required: false,
  })
  handledAt?: Date
}

export class ReportIdDto {
  @NumberProperty({
    description: 'Report ID',
    example: 1,
    required: true,
    min: 1,
  })
  reportId!: number
}

export class ReportCommentDto extends PickType(BaseCommentReportDto, [
  'commentId',
  'reason',
  'description',
  'evidenceUrl',
]) {}

export class QueryCommentReportDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseCommentReportDto), ['status']),
) {}

export class HandleCommentReportDto extends IntersectionType(
  ReportIdDto,
  PickType(BaseCommentReportDto, ['handlingNote']),
) {
  @ApiProperty({
    description: 'Handle status',
    enum: [ReportStatus.RESOLVED, ReportStatus.REJECTED],
    example: ReportStatus.RESOLVED,
  })
  @IsString()
  @IsIn([ReportStatus.RESOLVED, ReportStatus.REJECTED])
  status!: ReportStatus.RESOLVED | ReportStatus.REJECTED
}
