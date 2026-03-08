import { ReportReasonEnum, ReportTargetTypeEnum } from '@libs/base/constant'
import {
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { OmitType } from '@nestjs/swagger'
import { IsIn, IsOptional } from 'class-validator'

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

export class CreateWorkReportBodyDto extends OmitType(CreateWorkReportDto, [
  'reporterId',
]) {}
