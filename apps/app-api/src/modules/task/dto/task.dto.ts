import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  TaskTypeEnum,
  TaskUserVisibleStatusEnum,
} from '@libs/growth/task'
import {
  EnumProperty,
  JsonProperty,
  NestedProperty,
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

export class AppTaskPageResponseDto extends PickType(BaseTaskDto, [
  'id',
  'createdAt',
  'updatedAt',
  'code',
  'title',
  'description',
  'cover',
  'type',
  'priority',
  'claimMode',
  'completeMode',
  'objectiveType',
  'eventCode',
  'objectiveConfig',
  'targetCount',
  'rewardConfig',
  'publishStartAt',
  'publishEndAt',
  'repeatRule',
] as const) {
  @EnumProperty({
    description: '用户可见任务状态',
    example: TaskUserVisibleStatusEnum.CLAIMABLE,
    enum: TaskUserVisibleStatusEnum,
    validation: false,
  })
  visibleStatus!: TaskUserVisibleStatusEnum
}

export class MyTaskRelatedTaskDto extends PickType(BaseTaskDto, [
  'id',
  'code',
  'title',
  'description',
  'cover',
  'type',
  'objectiveType',
  'eventCode',
  'objectiveConfig',
  'rewardConfig',
  'targetCount',
  'completeMode',
  'claimMode',
] as const) {}

export class MyTaskPageResponseDto extends PickType(BaseTaskAssignmentDto, [
  'id',
  'createdAt',
  'updatedAt',
  'taskId',
  'cycleKey',
  'status',
  'rewardStatus',
  'rewardResultType',
  'progress',
  'target',
  'claimedAt',
  'completedAt',
  'expiredAt',
  'rewardSettledAt',
  'rewardLedgerIds',
  'lastRewardError',
] as const) {
  @EnumProperty({
    description: '用户可见任务状态',
    example: TaskUserVisibleStatusEnum.IN_PROGRESS,
    enum: TaskUserVisibleStatusEnum,
    validation: false,
  })
  visibleStatus!: TaskUserVisibleStatusEnum

  @NestedProperty({
    description: '任务摘要',
    required: false,
    type: MyTaskRelatedTaskDto,
    validation: false,
    nullable: true,
  })
  task?: MyTaskRelatedTaskDto | null
}

export class QueryMyTaskDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTaskAssignmentDto, ['status'] as const)),
) {
  @EnumProperty({
    description: '任务场景类型',
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
