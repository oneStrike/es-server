import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { IntersectionType, OmitType, PartialType } from '@nestjs/swagger'
import { TaskDefinitionStatusEnum } from '../task.constant'
import {
  QueryTaskDefinitionPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
} from './task-query.dto'
import { BaseTaskDefinitionDto, TaskStepSummaryDto } from './task-view.dto'

export class CreateTaskStepDto extends OmitType(TaskStepSummaryDto, [
  ...OMIT_BASE_FIELDS,
  'stepKey',
  'stepNo',
  'title',
] as const) {}

export class CreateTaskDefinitionDto extends OmitType(BaseTaskDefinitionDto, [
  ...OMIT_BASE_FIELDS,
  'code',
] as const) {
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

export class QueryTaskDefinitionDetailDto extends IdDto {}

export {
  QueryTaskDefinitionPageDto,
  QueryTaskInstancePageDto,
  QueryTaskReconciliationPageDto,
}
