import { BaseGrowthRewardSettlementDto } from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import {
  GrowthRewardSettlementResultTypeEnum,
  GrowthRewardSettlementStatusEnum,
} from '@libs/growth/growth-reward/growth-reward.constant'
import { GrowthRewardItemDto } from '@libs/growth/reward-rule/dto/reward-item.dto'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { DateProperty } from '@libs/platform/decorators/validate/date-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { BaseDto } from '@libs/platform/dto/base.dto'
import { PickType } from '@nestjs/swagger'
import { TaskClaimModeEnum, TaskCompletionPolicyEnum, TaskDefinitionStatusEnum, TaskInstanceStatusEnum, TaskRepeatCycleEnum, TaskStepDedupeScopeEnum, TaskStepProgressModeEnum, TaskStepTriggerModeEnum, TaskTypeEnum, TaskVisibleStatusEnum } from '../task.constant'

import { TaskTemplateFilterValueDto } from './task-template.dto'

export class BaseTaskDefinitionDto extends BaseDto {
  @StringProperty({
    description: '任务编码',
    example: 'browse_unique_work_daily',
    maxLength: 50,
  })
  code!: string

  @StringProperty({
    description: '任务标题',
    example: '浏览不同作品',
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '任务描述',
    example: '浏览不同作品达到指定数量后完成。',
    required: false,
    maxLength: 1000,
  })
  description?: string

  @StringProperty({
    description: '任务封面',
    example: 'https://example.com/task-cover.png',
    required: false,
    maxLength: 255,
  })
  cover?: string

  @EnumProperty({
    description: '任务场景类型（1=新手引导；2=日常；4=活动）',
    example: TaskTypeEnum.DAILY,
    enum: TaskTypeEnum,
  })
  sceneType!: TaskTypeEnum

  @EnumProperty({
    description: '任务状态（0=草稿；1=生效中；2=已暂停；3=已归档）',
    example: TaskDefinitionStatusEnum.ACTIVE,
    enum: TaskDefinitionStatusEnum,
  })
  status!: TaskDefinitionStatusEnum

  @NumberProperty({
    description: '任务优先级（0=默认优先级，数值越大越靠前）',
    example: 10,
  })
  priority!: number

  @EnumProperty({
    description: '领取方式（1=自动领取；2=手动领取）',
    example: TaskClaimModeEnum.AUTO,
    enum: TaskClaimModeEnum,
  })
  claimMode!: TaskClaimModeEnum

  @EnumProperty({
    description: '完成聚合策略（1=所有步骤完成即完成）',
    example: TaskCompletionPolicyEnum.ALL_STEPS,
    enum: TaskCompletionPolicyEnum,
  })
  completionPolicy!: TaskCompletionPolicyEnum

  @EnumProperty({
    description: '重复周期类型（0=一次性；1=每日；2=每周；3=每月）',
    example: TaskRepeatCycleEnum.DAILY,
    enum: TaskRepeatCycleEnum,
  })
  repeatType!: TaskRepeatCycleEnum

  @StringProperty({
    description: '重复周期时区',
    example: 'Asia/Shanghai',
    required: false,
    maxLength: 64,
  })
  repeatTimezone?: string

  @DateProperty({
    description: '生效开始时间',
    example: '2026-04-22T00:00:00.000Z',
    required: false,
  })
  startAt?: Date | null

  @DateProperty({
    description: '生效结束时间',
    example: '2026-05-01T00:00:00.000Z',
    required: false,
  })
  endAt?: Date | null

  @StringProperty({
    description: '受众分群键',
    example: 'new_user_segment',
    required: false,
    maxLength: 80,
  })
  audienceSegmentId?: string

  @ArrayProperty({
    description: '任务完成后统一发放的奖励项列表',
    itemClass: GrowthRewardItemDto,
    required: false,
    example: [{ assetType: 1, assetKey: '', amount: 10 }],
  })
  rewardItems?: GrowthRewardItemDto[] | null
}

export class TaskStepSummaryDto extends BaseDto {
  @StringProperty({
    description: '步骤稳定键',
    example: 'step_001',
    maxLength: 50,
  })
  stepKey!: string

  @StringProperty({
    description: '步骤标题',
    example: '浏览不同对象',
    maxLength: 200,
  })
  title!: string

  @StringProperty({
    description: '步骤描述',
    example: '浏览不同作品达到指定数量后完成。',
    required: false,
    maxLength: 1000,
  })
  description?: string

  @NumberProperty({
    description: '步骤顺序',
    example: 1,
  })
  stepNo!: number

  @EnumProperty({
    description: '步骤触发方式（1=手动；2=事件驱动）',
    example: TaskStepTriggerModeEnum.EVENT,
    enum: TaskStepTriggerModeEnum,
  })
  triggerMode!: TaskStepTriggerModeEnum

  @EnumProperty({
    description: '步骤进度模式（1=一次完成；2=普通累计；3=按唯一对象累计）',
    example: TaskStepProgressModeEnum.UNIQUE_COUNT,
    enum: TaskStepProgressModeEnum,
  })
  progressMode!: TaskStepProgressModeEnum

  @NumberProperty({
    description: '目标值',
    example: 5,
  })
  targetValue!: number

  @StringProperty({
    description: '事件模板键',
    example: 'COMIC_WORK_VIEW',
    required: false,
    maxLength: 80,
  })
  templateKey?: string

  @ArrayProperty({
    description: '步骤过滤条件列表',
    itemClass: TaskTemplateFilterValueDto,
    example: [{ key: 'targetType', label: '目标类型', value: 'comic_work' }],
    required: false,
  })
  filters?: TaskTemplateFilterValueDto[] | null

  @StringProperty({
    description: '唯一维度键',
    example: 'object_id',
    required: false,
    maxLength: 80,
  })
  uniqueDimensionKey?: string

  @EnumProperty({
    description: '去重范围（1=按周期唯一；2=终身唯一）',
    example: TaskStepDedupeScopeEnum.LIFETIME,
    enum: TaskStepDedupeScopeEnum,
    required: false,
  })
  dedupeScope?: TaskStepDedupeScopeEnum | null
}

export class TaskRewardSettlementSummaryDto extends PickType(
  BaseGrowthRewardSettlementDto,
  [
    'id',
    'settlementStatus',
    'settlementResultType',
    'retryCount',
    'lastRetryAt',
    'settledAt',
    'lastError',
    'ledgerRecordIds',
  ] as const,
) {
  @EnumProperty({
    description: '补偿状态（0=待补偿重试；1=已补偿成功；2=终态失败）',
    example: GrowthRewardSettlementStatusEnum.SUCCESS,
    enum: GrowthRewardSettlementStatusEnum,
    validation: false,
  })
  settlementStatus!: GrowthRewardSettlementStatusEnum

  @EnumProperty({
    description: '补偿结果类型（1=真实落账；2=命中幂等；3=本次处理失败）',
    example: GrowthRewardSettlementResultTypeEnum.APPLIED,
    enum: GrowthRewardSettlementResultTypeEnum,
    required: false,
    validation: false,
  })
  settlementResultType?: GrowthRewardSettlementResultTypeEnum | null
}

export class TaskInstanceStepViewDto extends BaseDto {
  @NumberProperty({
    description: '步骤定义 ID',
    example: 1,
  })
  stepId!: number

  @EnumProperty({
    description: '步骤状态（0=待开始；1=进行中；2=已完成；3=已过期）',
    example: TaskInstanceStatusEnum.IN_PROGRESS,
    enum: TaskInstanceStatusEnum,
  })
  status!: TaskInstanceStatusEnum

  @NumberProperty({
    description: '当前进度值',
    example: 2,
  })
  currentValue!: number

  @NumberProperty({
    description: '目标值',
    example: 5,
  })
  targetValue!: number

  @DateProperty({
    description: '步骤完成时间',
    example: '2026-04-22T10:00:00.000Z',
    required: false,
  })
  completedAt?: Date | null
}

export class AdminTaskDefinitionListItemDto extends PickType(
  BaseTaskDefinitionDto,
  [
    'id',
    'createdAt',
    'updatedAt',
    'code',
    'title',
    'description',
    'cover',
    'sceneType',
    'status',
    'priority',
    'claimMode',
    'completionPolicy',
    'repeatType',
    'repeatTimezone',
    'startAt',
    'endAt',
    'audienceSegmentId',
    'rewardItems',
  ] as const,
) {
  @NumberProperty({
    description: '步骤数量',
    example: 1,
    validation: false,
  })
  stepCount!: number

  @NumberProperty({
    description: '活跃实例数量',
    example: 12,
    validation: false,
  })
  activeInstanceCount!: number

  @NumberProperty({
    description: '待补偿奖励数量',
    example: 2,
    validation: false,
  })
  pendingRewardCompensationCount!: number
}

export class AdminTaskDefinitionDetailDto extends AdminTaskDefinitionListItemDto {
  @ArrayProperty({
    description: '步骤列表',
    itemClass: TaskStepSummaryDto,
  })
  steps!: TaskStepSummaryDto[]
}

export class TaskInstanceViewDto extends BaseDto {
  @NumberProperty({
    description: '任务头 ID',
    example: 1,
  })
  taskId!: number

  @NumberProperty({
    description: '用户 ID',
    example: 10001,
  })
  userId!: number

  @StringProperty({
    description: '周期键',
    example: '2026-04-22',
    maxLength: 64,
  })
  cycleKey!: string

  @EnumProperty({
    description: '实例状态（0=待开始；1=进行中；2=已完成；3=已过期）',
    example: TaskInstanceStatusEnum.IN_PROGRESS,
    enum: TaskInstanceStatusEnum,
  })
  status!: TaskInstanceStatusEnum

  @EnumProperty({
    description:
      '统一后的用户可见状态（claimable=可领取；claimed=已领取；in_progress=进行中；completed=已完成；reward_pending=奖励待补偿；reward_granted=奖励已到账；expired=已过期；unavailable=当前不可用）',
    example: TaskVisibleStatusEnum.IN_PROGRESS,
    enum: TaskVisibleStatusEnum,
    validation: false,
  })
  visibleStatus!: TaskVisibleStatusEnum

  @NumberProperty({
    description: '是否需要奖励结算（0=无奖励；1=需要奖励结算）',
    example: 1,
  })
  rewardApplicable!: number

  @NumberProperty({
    description: '奖励结算事实 ID',
    example: 501,
    required: false,
  })
  rewardSettlementId?: number | null

  @DateProperty({
    description: '领取时间',
    example: '2026-04-22T09:00:00.000Z',
    required: false,
  })
  claimedAt?: Date | null

  @DateProperty({
    description: '完成时间',
    example: '2026-04-22T10:00:00.000Z',
    required: false,
  })
  completedAt?: Date | null

  @DateProperty({
    description: '过期时间',
    example: '2026-04-23T00:00:00.000Z',
    required: false,
  })
  expiredAt?: Date | null

  @ArrayProperty({
    description: '步骤进度列表',
    itemClass: TaskInstanceStepViewDto,
  })
  steps!: TaskInstanceStepViewDto[]

  @NestedProperty({
    description: '奖励结算摘要',
    type: TaskRewardSettlementSummaryDto,
    required: false,
    validation: false,
    nullable: false,
  })
  rewardSettlement?: TaskRewardSettlementSummaryDto | null
}

export class TaskLatestEventSummaryDto {
  @StringProperty({
    description: '最近事件业务键',
    example: 'view:comic:123:user:10001',
    required: false,
    maxLength: 180,
  })
  eventBizKey?: string | null

  @DateProperty({
    description: '最近事件发生时间',
    example: '2026-04-22T09:30:00.000Z',
    required: false,
  })
  occurredAt?: Date | null

  @BooleanProperty({
    description: '最近事件是否被接受计入进度',
    example: true,
    validation: false,
  })
  accepted!: boolean

  @StringProperty({
    description: '最近事件拒绝原因',
    example: 'duplicate_unique_dimension',
    required: false,
    maxLength: 120,
  })
  rejectReason?: string | null

  @StringProperty({
    description: '最近事件目标类型',
    example: 'comic_work',
    required: false,
    maxLength: 80,
  })
  targetType?: string | null

  @NumberProperty({
    description: '最近事件目标 ID',
    example: 123,
    required: false,
  })
  targetId?: number | null
}

export class TaskUniqueFactSummaryDto {
  @NumberProperty({
    description: '步骤定义 ID',
    example: 1,
    validation: false,
  })
  stepId!: number

  @EnumProperty({
    description: '去重范围（1=按周期唯一；2=终身唯一）',
    example: TaskStepDedupeScopeEnum.LIFETIME,
    enum: TaskStepDedupeScopeEnum,
    validation: false,
  })
  dedupeScope!: TaskStepDedupeScopeEnum

  @NumberProperty({
    description: '当前实例对应作用域内已命中的唯一事实数量',
    example: 3,
    validation: false,
  })
  factCount!: number

  @StringProperty({
    description: '最近一次命中的唯一维度值',
    example: '123',
    required: false,
    maxLength: 255,
    validation: false,
  })
  latestDimensionValue?: string | null

  @DateProperty({
    description: '最近一次命中的发生时间',
    example: '2026-04-22T09:30:00.000Z',
    required: false,
    validation: false,
  })
  latestOccurredAt?: Date | null
}

export class AdminTaskReconciliationItemDto extends TaskInstanceViewDto {
  @NestedProperty({
    description: '任务头详情',
    type: AdminTaskDefinitionDetailDto,
    required: false,
    validation: false,
    nullable: false,
  })
  task?: AdminTaskDefinitionDetailDto | null

  @NestedProperty({
    description: '最近事件摘要',
    type: TaskLatestEventSummaryDto,
    required: false,
    validation: false,
    nullable: false,
  })
  latestEvent?: TaskLatestEventSummaryDto | null

  @ArrayProperty({
    description: '唯一事实摘要列表',
    itemClass: TaskUniqueFactSummaryDto,
    required: false,
    validation: false,
  })
  uniqueFacts?: TaskUniqueFactSummaryDto[]
}
