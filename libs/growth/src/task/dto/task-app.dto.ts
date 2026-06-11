import {
  ArrayProperty,
  EnumProperty,
  NestedProperty,
} from '@libs/platform/decorators'

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
    'sortOrder',
    'claimMode',
    'completionPolicy',
    'repeatType',
    'startAt',
    'endAt',
    'rewardItems',
  ] as const,
) {
  @EnumProperty({
    description:
      '用户可见状态（可领取；已领取；进行中；已完成；奖励待补偿；奖励已到账；已过期；当前不可用）',
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
    validation: false,
    nullable: true,
  })
  task!: AppAvailableTaskPageItemDto | null
}
