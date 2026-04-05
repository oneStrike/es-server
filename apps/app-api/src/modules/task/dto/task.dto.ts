import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  TaskUserVisibleStatusEnum,
} from '@libs/growth/task'
import {
  EnumProperty,
  NestedProperty,
} from '@libs/platform/decorators'
import {
  PickType,
} from '@nestjs/swagger'

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
