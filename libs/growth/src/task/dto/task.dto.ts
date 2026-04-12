import type {
  TaskObjectiveConfig,
  TaskRepeatRuleConfig,
  TaskRewardConfig,
} from '../task.type'
import { MessageNotificationDispatchStatusEnum } from '@libs/message/notification/notification.constant';
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { IsInt } from 'class-validator'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import {
  TaskAssignmentRewardResultTypeEnum,
  TaskAssignmentRewardStatusEnum,
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskObjectiveTypeEnum,
  TaskStatusEnum,
  TaskTypeEnum,
  TaskUserVisibleStatusEnum,
} from '../task.constant'

export class BaseTaskDto extends BaseDto {
  @StringProperty({
    description: '任务编码',
    example: 'newbie_001',
    required: true,
    maxLength: 50,
  })
  code!: string

  @StringProperty({
    description: '任务标题',
    example: '完善个人资料',
    required: true,
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '任务说明',
    example: '完成头像上传与昵称设置',
    required: false,
    maxLength: 1000,
  })
  description?: string

  @StringProperty({
    description: '封面图',
    example: 'https://example.com/cover.png',
    required: false,
    maxLength: 255,
  })
  cover?: string

  @EnumProperty({
    description: '任务场景类型',
    example: TaskTypeEnum.ONBOARDING,
    enum: TaskTypeEnum,
  })
  type!: TaskTypeEnum

  @EnumProperty({
    description: '任务状态',
    example: TaskStatusEnum.DRAFT,
    enum: TaskStatusEnum,
  })
  status!: TaskStatusEnum

  @NumberProperty({ description: '优先级', example: 10 })
  priority!: number

  @BooleanProperty({ description: '启用状态', example: true })
  isEnabled!: boolean

  @EnumProperty({
    description: '领取模式',
    example: TaskClaimModeEnum.AUTO,
    enum: TaskClaimModeEnum,
  })
  claimMode!: TaskClaimModeEnum

  @EnumProperty({
    description: '完成模式',
    example: TaskCompleteModeEnum.AUTO,
    enum: TaskCompleteModeEnum,
  })
  completeMode!: TaskCompleteModeEnum

  @EnumProperty({
    description: '任务目标类型',
    example: TaskObjectiveTypeEnum.MANUAL,
    enum: TaskObjectiveTypeEnum,
  })
  objectiveType!: TaskObjectiveTypeEnum

  @EnumProperty({
    description: '目标事件编码，EVENT_COUNT 任务必填',
    example: GrowthRuleTypeEnum.COMIC_CHAPTER_READ,
    enum: GrowthRuleTypeEnum,
    required: false,
  })
  eventCode?: GrowthRuleTypeEnum | null

  @NumberProperty({
    description: '完成目标次数，必须为大于 0 的整数',
    example: 1,
    min: 1,
  })
  targetCount!: number

  @JsonProperty({
    description: '奖励配置，当前仅支持 points / experience，且值必须为正整数',
    example: { points: 10, experience: 5 },
    required: false,
  })
  rewardConfig?: TaskRewardConfig | null

  @JsonProperty({
    description: '目标附加配置，EVENT_COUNT 任务可用于表达额外过滤条件',
    example: { sectionId: 10 },
    required: false,
  })
  objectiveConfig?: TaskObjectiveConfig | null

  @DateProperty({
    description: '发布开始时间',
    example: '2026-02-13T00:00:00.000Z',
    required: false,
  })
  publishStartAt?: Date | null

  @DateProperty({
    description: '发布结束时间',
    example: '2026-02-28T23:59:59.000Z',
    required: false,
  })
  publishEndAt?: Date | null

  @JsonProperty({
    description:
      '周期规则，当前仅识别 type=once/daily/weekly/monthly；timezone 可选，使用 IANA 时区标识',
    example: { type: 'daily', timezone: 'Asia/Shanghai' },
    required: false,
  })
  repeatRule?: TaskRepeatRuleConfig | null

  @NumberProperty({ description: '创建人ID', example: 1, required: false })
  createdById?: number

  @NumberProperty({ description: '更新人ID', example: 1, required: false })
  updatedById?: number

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

export class BaseTaskAssignmentDto extends BaseDto {
  @NumberProperty({ description: '任务ID', example: 1 })
  taskId!: number

  @NumberProperty({ description: '用户ID', example: 10001 })
  userId!: number

  @StringProperty({
    description: '周期实例键',
    example: '2026-02-13',
    required: true,
    maxLength: 32,
  })
  cycleKey!: string

  @EnumProperty({
    description: '任务分配状态，PENDING 表示已领取待开始',
    example: TaskAssignmentStatusEnum.PENDING,
    enum: TaskAssignmentStatusEnum,
  })
  status!: TaskAssignmentStatusEnum

  @EnumProperty({
    description: '奖励结算状态',
    example: TaskAssignmentRewardStatusEnum.PENDING,
    enum: TaskAssignmentRewardStatusEnum,
  })
  rewardStatus!: TaskAssignmentRewardStatusEnum

  @EnumProperty({
    description: '奖励结算结果类型',
    example: TaskAssignmentRewardResultTypeEnum.APPLIED,
    enum: TaskAssignmentRewardResultTypeEnum,
    required: false,
  })
  rewardResultType?: TaskAssignmentRewardResultTypeEnum | null

  @NumberProperty({ description: '当前进度', example: 0 })
  progress!: number

  @NumberProperty({ description: '目标进度', example: 1 })
  target!: number

  @NumberProperty({
    description: '乐观锁版本号',
    example: 0,
    required: true,
    default: 0,
    validation: false,
  })
  version!: number

  @DateProperty({
    description: '领取时间',
    example: '2026-02-13T00:00:00.000Z',
    required: false,
  })
  claimedAt?: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-02-13T08:00:00.000Z',
    required: false,
  })
  completedAt?: Date | null

  @DateProperty({
    description: '过期时间',
    example: '2026-02-14T00:00:00.000Z',
    required: false,
  })
  expiredAt?: Date | null

  @DateProperty({
    description: '奖励结算时间',
    example: '2026-02-13T08:00:01.000Z',
    required: false,
  })
  rewardSettledAt?: Date | null

  @ArrayProperty({
    description: '本次奖励关联到账本记录 ID 列表',
    itemType: 'number',
    example: [101, 102],
    required: true,
    validation: false,
  })
  rewardLedgerIds!: number[]

  @StringProperty({
    description: '上次奖励失败原因',
    example: '任务奖励发放失败：用户不存在',
    required: false,
    maxLength: 500,
    validation: false,
  })
  lastRewardError?: string | null

  @JsonProperty({
    description: '任务快照',
    example: { title: '完善个人资料', rewardConfig: { points: 10 } },
    required: false,
  })
  taskSnapshot?: Record<string, unknown> | null

  @JsonProperty({
    description: '上下文',
    example: { source: 'app' },
    required: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

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

export class QueryAvailableTaskDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTaskDto, ['type'] as const)),
) {}

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

  @NumberProperty({
    description: '进度增量，必须为大于 0 的整数',
    example: 1,
    min: 1,
  })
  @IsInt({ message: '进度增量必须是整数' })
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

export class RetryCompletedTaskRewardsDto {
  @NumberProperty({
    description: '本次最多扫描的 assignment 数量',
    example: 100,
    required: false,
    min: 1,
  })
  limit?: number
}

/**
 * 可领取任务分页项 DTO。
 */
export class AvailableTaskPageItemDto extends PickType(BaseTaskDto, [
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

/**
 * 我的任务关联任务 DTO。
 */
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

/**
 * 我的任务分页项 DTO。
 */
export class MyTaskPageItemDto extends PickType(BaseTaskAssignmentDto, [
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
    nullable: false,
  })
  task?: MyTaskRelatedTaskDto | null
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
    nullable: false,
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
    nullable: false,
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
    nullable: false,
  })
  rewardReminder?: AdminTaskRewardReminderDto | null

  @NestedProperty({
    description: '任务快照摘要',
    type: AdminTaskAssignmentRelatedTaskDto,
    required: false,
    validation: false,
    nullable: false,
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
