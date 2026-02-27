import { PageDto } from '@libs/base/dto'
import { BaseUserPointRecordDto } from '@libs/user/point'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

export class QueryMyPointRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserPointRecordDto, ['ruleId', 'targetType', 'targetId'])),
) {}
