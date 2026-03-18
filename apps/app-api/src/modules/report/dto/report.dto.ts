import { BaseReportDto } from '@libs/interaction'
import { IntersectionType, PickType } from '@nestjs/swagger'

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
