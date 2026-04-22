import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { IdDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  BaseTaskDefinitionDto,
  TaskInstanceViewDto,
  TaskRewardSettlementSummaryDto,
} from './task-view.dto'

class TaskDefinitionPageFilterFieldsDto extends PickType(
  BaseTaskDefinitionDto,
  ['title', 'status', 'sceneType'] as const,
) {}

class TaskAvailablePageFilterFieldsDto extends PickType(BaseTaskDefinitionDto, [
  'sceneType',
] as const) {}

class TaskInstancePageFilterFieldsDto extends IntersectionType(
  PickType(TaskInstanceViewDto, ['taskId', 'userId', 'status'] as const),
  PickType(BaseTaskDefinitionDto, ['sceneType'] as const),
) {}

class TaskMyPageFilterFieldsDto extends IntersectionType(
  PickType(TaskInstanceViewDto, ['status'] as const),
  PickType(BaseTaskDefinitionDto, ['sceneType'] as const),
) {}

class TaskReconciliationSharedFieldsDto extends IntersectionType(
  PickType(TaskInstanceViewDto, [
    'taskId',
    'userId',
    'rewardSettlementId',
  ] as const),
  PickType(TaskRewardSettlementSummaryDto, ['settlementStatus'] as const),
) {}

class TaskReconciliationFilterDto extends TaskReconciliationSharedFieldsDto {
  @NumberProperty({
    description: '任务实例 ID',
    example: 88,
    required: false,
  })
  instanceId?: number
}

export class QueryTaskDefinitionPageDto extends IntersectionType(
  PageDto,
  PartialType(TaskDefinitionPageFilterFieldsDto),
) {}

export class QueryAvailableTaskPageDto extends IntersectionType(
  PageDto,
  PartialType(TaskAvailablePageFilterFieldsDto),
) {}

export class QueryTaskInstancePageDto extends IntersectionType(
  PageDto,
  PartialType(TaskInstancePageFilterFieldsDto),
) {}

export class QueryMyTaskPageDto extends IntersectionType(
  PageDto,
  PartialType(TaskMyPageFilterFieldsDto),
) {}

export class QueryTaskReconciliationPageDto extends IntersectionType(
  PageDto,
  PartialType(TaskReconciliationFilterDto),
) {}

export class TaskProgressDto extends IdDto {
  @NumberProperty({
    description: '进度增量，必须为大于 0 的整数',
    example: 1,
  })
  delta!: number

  @StringProperty({
    description: '上下文 JSON 字符串',
    example: '{\"source\":\"app\"}',
    required: false,
  })
  context?: string
}
