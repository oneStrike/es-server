import { BaseReportDto, ReportStatusEnum } from '@libs/interaction/report'
import { EnumProperty, StringProperty } from '@libs/platform/decorators'
import { IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

const AdminHandleReportStatusEnum = {
  RESOLVED: ReportStatusEnum.RESOLVED,
  REJECTED: ReportStatusEnum.REJECTED,
} as const

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
