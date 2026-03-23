import { BaseReportDto } from '@libs/interaction/report'
import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class ReportTargetDto extends PickType(BaseReportDto, [
  'targetId',
  'targetType',
]) {}

export class ReportReasonBodyDto extends PickType(BaseReportDto, [
  'reasonType',
  'description',
  'evidenceUrl',
]) {}

export class CreateReportBodyDto extends IntersectionType(
  ReportTargetDto,
  ReportReasonBodyDto,
) {}

export class QueryMyReportPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseReportDto, ['targetType', 'targetId', 'reasonType', 'status']),
  ),
) {}
