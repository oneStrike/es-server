import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  TaskTypeEnum,
} from '@libs/growth/task'
import {
  EnumProperty,
  JsonProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class QueryAppTaskDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTaskDto, ['type'] as const)),
) {}

export class QueryMyTaskDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTaskAssignmentDto, ['status'] as const)),
) {
  @EnumProperty({
    description: '任务类型',
    example: TaskTypeEnum.DAILY,
    required: false,
    enum: TaskTypeEnum,
  })
  type?: TaskTypeEnum
}

export class ClaimTaskDto extends PickType(BaseTaskAssignmentDto, [
  'taskId',
] as const) {}

export class TaskProgressDto {
  @NumberProperty({ description: '任务ID', example: 1 })
  taskId!: number

  @NumberProperty({ description: '进度增量', example: 1 })
  delta!: number

  @JsonProperty({
    description: '变更上下文',
    example: '{"action":"post_comment"}',
    required: false,
  })
  context?: string
}

export class TaskCompleteDto extends PickType(BaseTaskAssignmentDto, [
  'taskId',
] as const) {}
