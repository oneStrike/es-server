import {
  BaseTaskAssignmentDto,
  BaseTaskDto,
  TaskUserVisibleStatusEnum,
} from '@libs/growth/task'
import { MessageNotificationDispatchStatusEnum } from '@libs/message/notification'
import {
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class CreateTaskDto extends OmitType(BaseTaskDto, [
  ...OMIT_BASE_FIELDS,
  'createdById',
  'updatedById',
  'deletedAt',
] as const) {}

export class UpdateTaskDto extends IntersectionType(
  PartialType(CreateTaskDto),
  IdDto,
) {}

export class UpdateTaskStatusDto extends IntersectionType(
  IdDto,
  PartialType(PickType(BaseTaskDto, ['status', 'isEnabled'] as const)),
) {}

export class QueryTaskDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskDto, ['title', 'status', 'type', 'isEnabled'] as const),
  ),
) {}

export class QueryTaskAssignmentDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskAssignmentDto, ['taskId', 'userId', 'status'] as const),
  ),
) {}

export class QueryTaskAssignmentReconciliationDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskAssignmentDto, ['taskId', 'userId', 'rewardStatus'] as const),
  ),
) {
  @NumberProperty({
    description: '任务分配 ID',
    example: 88,
    required: false,
  })
  assignmentId?: number

  @NumberProperty({
    description: '事件编码',
    example: 10,
    required: false,
  })
  eventCode?: number

  @StringProperty({
    description: '事件推进幂等键',
    example: 'comment:create:topic:100:user:9',
    required: false,
    maxLength: 180,
  })
  eventBizKey?: string

  @EnumProperty({
    description: '奖励到账提醒投递状态',
    example: MessageNotificationDispatchStatusEnum.DELIVERED,
    enum: MessageNotificationDispatchStatusEnum,
    required: false,
  })
  notificationStatus?: MessageNotificationDispatchStatusEnum
}

export class RetryTaskAssignmentRewardDto extends IdDto {}

export class RetryCompletedTaskRewardsDto {
  @NumberProperty({
    description: '本次最多扫描的 assignment 数量',
    example: 100,
    required: false,
    min: 1,
  })
  limit?: number
}

export class AdminTaskReminderSummaryDto {
  @StringProperty({
    description: '最近一次任务提醒子类型',
    example: 'task_reward_granted',
    required: false,
    validation: false,
  })
  reminderKind?: string

  @EnumProperty({
    description: '最近一次提醒投递状态',
    example: MessageNotificationDispatchStatusEnum.DELIVERED,
    enum: MessageNotificationDispatchStatusEnum,
    required: false,
    validation: false,
  })
  status?: MessageNotificationDispatchStatusEnum

  @StringProperty({
    description: '最近一次提醒失败原因',
    example: '通知偏好关闭',
    required: false,
    validation: false,
  })
  failureReason?: string

  @DateProperty({
    description: '最近一次提醒尝试时间',
    example: '2026-03-31T08:15:00.000Z',
    required: false,
    validation: false,
  })
  lastAttemptAt?: Date

  @DateProperty({
    description: '最近一次提醒状态更新时间',
    example: '2026-03-31T08:15:01.000Z',
    required: false,
    validation: false,
  })
  updatedAt?: Date
}

export class AdminTaskPageResponseDto extends PickType(BaseTaskDto, [
  'id',
  'createdAt',
  'updatedAt',
  'code',
  'title',
  'description',
  'cover',
  'type',
  'status',
  'priority',
  'isEnabled',
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
  @NumberProperty({
    description: '活跃 assignment 数（PENDING/IN_PROGRESS/COMPLETED）',
    example: 12,
    validation: false,
  })
  activeAssignmentCount!: number

  @NumberProperty({
    description: '待补偿奖励数（已完成但奖励未成功）',
    example: 2,
    validation: false,
  })
  pendingRewardCompensationCount!: number

  @NestedProperty({
    description: '最近一次任务提醒投递摘要',
    type: AdminTaskReminderSummaryDto,
    required: false,
    validation: false,
    nullable: true,
  })
  latestReminder?: AdminTaskReminderSummaryDto | null
}

export class AdminTaskAssignmentRelatedTaskDto extends PickType(BaseTaskDto, [
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

export class AdminTaskAssignmentPageResponseDto extends PickType(
  BaseTaskAssignmentDto,
  [
    'id',
    'createdAt',
    'updatedAt',
    'taskId',
    'userId',
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
  ] as const,
) {
  @EnumProperty({
    description: '统一后的用户可见状态',
    example: TaskUserVisibleStatusEnum.REWARD_GRANTED,
    enum: TaskUserVisibleStatusEnum,
    validation: false,
  })
  visibleStatus!: TaskUserVisibleStatusEnum

  @NestedProperty({
    description: '任务快照摘要',
    type: AdminTaskAssignmentRelatedTaskDto,
    required: false,
    validation: false,
    nullable: true,
  })
  task?: AdminTaskAssignmentRelatedTaskDto | null
}

export class AdminTaskRewardReminderDto {
  @StringProperty({
    description: '奖励到账提醒 outbox bizKey',
    example: 'task:reminder:reward:assignment:88',
    required: false,
    validation: false,
  })
  bizKey?: string

  @EnumProperty({
    description: '奖励到账提醒投递状态',
    example: MessageNotificationDispatchStatusEnum.DELIVERED,
    enum: MessageNotificationDispatchStatusEnum,
    required: false,
    validation: false,
  })
  status?: MessageNotificationDispatchStatusEnum

  @StringProperty({
    description: '最近一次提醒失败原因',
    example: '通知模板不存在',
    required: false,
    validation: false,
  })
  failureReason?: string

  @DateProperty({
    description: '最近一次提醒尝试时间',
    example: '2026-03-31T09:00:00.000Z',
    required: false,
    validation: false,
  })
  lastAttemptAt?: Date
}

export class AdminTaskAssignmentReconciliationPageResponseDto extends PickType(
  AdminTaskAssignmentPageResponseDto,
  [
    'id',
    'createdAt',
    'updatedAt',
    'taskId',
    'userId',
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
    'visibleStatus',
  ] as const,
) {
  @NumberProperty({
    description: '最近一次命中 assignment 的事件编码',
    example: 10,
    required: false,
    validation: false,
  })
  latestEventCode?: number | null

  @StringProperty({
    description: '最近一次命中 assignment 的事件 bizKey',
    example: 'comment:create:topic:100:user:9',
    required: false,
    validation: false,
  })
  latestEventBizKey?: string | null

  @DateProperty({
    description: '最近一次命中 assignment 的事件发生时间',
    example: '2026-03-31T08:55:00.000Z',
    required: false,
    validation: false,
  })
  latestEventOccurredAt?: Date | null

  @NestedProperty({
    description: '奖励到账提醒摘要',
    type: AdminTaskRewardReminderDto,
    required: false,
    validation: false,
    nullable: true,
  })
  rewardReminder?: AdminTaskRewardReminderDto | null

  @NestedProperty({
    description: '任务快照摘要',
    type: AdminTaskAssignmentRelatedTaskDto,
    required: false,
    validation: false,
    nullable: true,
  })
  task?: AdminTaskAssignmentRelatedTaskDto | null
}

export class RetryCompletedTaskRewardsResponseDto {
  @NumberProperty({
    description: '本次扫描到的待补偿 assignment 数',
    example: 12,
    validation: false,
  })
  scannedCount!: number

  @NumberProperty({
    description: '本次实际触发补偿结算的 assignment 数',
    example: 12,
    validation: false,
  })
  triggeredCount!: number
}
