import { EnumProperty, NestedProperty } from '@libs/platform/decorators'

import { IdDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { TaskDefinitionStatusEnum } from '../task.constant'
import { BaseTaskDefinitionDto, TaskStepSummaryDto } from './task-view.dto'

class TaskStepRequiredWritableFieldsDto extends PickType(TaskStepSummaryDto, [
  'triggerMode',
  'targetValue',
] as const) {}

class TaskStepNullableWritableFieldsDto extends PartialType(
  PickType(TaskStepSummaryDto, [
    'description',
    'templateKey',
    'filters',
    'dedupeScope',
  ] as const),
) {}

export class CreateTaskStepDto extends IntersectionType(
  TaskStepRequiredWritableFieldsDto,
  TaskStepNullableWritableFieldsDto,
) {}

class TaskDefinitionRequiredWritableFieldsDto extends PickType(
  BaseTaskDefinitionDto,
  [
    'title',
    'sceneType',
    'status',
    'sortOrder',
    'claimMode',
    'completionPolicy',
    'repeatType',
  ] as const,
) {}

class TaskDefinitionNullableWritableFieldsDto extends PartialType(
  PickType(BaseTaskDefinitionDto, [
    'description',
    'cover',
    'startAt',
    'endAt',
    'rewardItems',
  ] as const),
) {}

export class CreateTaskDefinitionDto extends IntersectionType(
  TaskDefinitionRequiredWritableFieldsDto,
  TaskDefinitionNullableWritableFieldsDto,
) {
  @NestedProperty({
    description: '唯一步骤定义',
    type: CreateTaskStepDto,
  })
  step!: CreateTaskStepDto
}

export class UpdateTaskDefinitionDto extends IntersectionType(
  PartialType(CreateTaskDefinitionDto),
  IdDto,
) {}

export class UpdateTaskDefinitionStatusDto extends IdDto {
  @EnumProperty({
    description: '任务状态（0=草稿；1=生效中；2=已暂停；3=已归档）',
    example: TaskDefinitionStatusEnum.ACTIVE,
    enum: TaskDefinitionStatusEnum,
  })
  status!: TaskDefinitionStatusEnum
}
