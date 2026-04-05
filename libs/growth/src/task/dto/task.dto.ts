import type {
  TaskObjectiveConfig,
  TaskRepeatRuleConfig,
  TaskRewardConfig,
} from '../task.type'
import { MessageNotificationDispatchStatusEnum } from '@libs/message/notification'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
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
    example: '2026-02-28T23:59:59.000Z',
    required: false,
    validation: false,
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
    example: '2026-02-14T00:00:00.000Z',
    required: false,
    validation: false,
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
