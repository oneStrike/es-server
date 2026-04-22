import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { PickType } from '@nestjs/swagger'
import { TaskVisibleStatusEnum } from '../task.constant'
import {
  BaseTaskDefinitionDto,
  TaskInstanceViewDto,
  TaskStepSummaryDto,
} from './task-view.dto'

export class AppAvailableTaskPageItemDto extends PickType(
  BaseTaskDefinitionDto,
  [
    'id',
    'code',
    'title',
    'description',
    'cover',
    'sceneType',
    'priority',
    'claimMode',
    'completionPolicy',
    'repeatType',
    'repeatTimezone',
    'startAt',
    'endAt',
    'rewardItems',
  ] as const,
) {
  @EnumProperty({
    description:
      '用户可见状态（claimable=可领取；claimed=已领取；in_progress=进行中；completed=已完成；reward_pending=奖励待补偿；reward_granted=奖励已到账；expired=已过期；unavailable=当前不可用）',
    example: TaskVisibleStatusEnum.CLAIMABLE,
    enum: TaskVisibleStatusEnum,
    validation: false,
  })
  visibleStatus!: TaskVisibleStatusEnum

  @ArrayProperty({
    description: '步骤摘要列表',
    itemClass: TaskStepSummaryDto,
  })
  steps!: TaskStepSummaryDto[]
}

export class AppMyTaskPageItemDto extends PickType(TaskInstanceViewDto, [
  'id',
  'taskId',
  'cycleKey',
  'visibleStatus',
  'rewardApplicable',
  'rewardSettlementId',
  'claimedAt',
  'completedAt',
  'expiredAt',
  'steps',
  'rewardSettlement',
] as const) {
  @NestedProperty({
    description: '任务头详情',
    type: AppAvailableTaskPageItemDto,
    required: false,
    validation: false,
    nullable: false,
  })
  task?: AppAvailableTaskPageItemDto | null
}
