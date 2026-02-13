import { ValidateBoolean } from '@libs/base/decorators/validate/validate-boolean'
import { ValidateDate } from '@libs/base/decorators/validate/validate-date'
import { ValidateEnum } from '@libs/base/decorators/validate/validate-enum'
import { ValidateJson } from '@libs/base/decorators/validate/validate-json'
import { ValidateNumber } from '@libs/base/decorators/validate/validate-number'
import { ValidateString } from '@libs/base/decorators/validate/validate-string'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
  TaskStatusEnum,
  TaskTypeEnum,
} from '../task.constant'

export class BaseTaskDto extends BaseDto {
  @ValidateString({ description: '任务编码', example: 'newbie_001' })
  code: string

  @ValidateString({ description: '任务标题', example: '完善个人资料' })
  title: string

  @ValidateString({
    description: '任务说明',
    example: '完成头像上传与昵称设置',
    required: false,
  })
  description?: string

  @ValidateString({
    description: '封面图',
    example: 'https://example.com/cover.png',
    required: false,
  })
  cover?: string

  @ValidateEnum({
    description: '任务类型',
    example: TaskTypeEnum.NEWBIE,
    enum: TaskTypeEnum,
  })
  type: TaskTypeEnum

  @ValidateEnum({
    description: '任务状态',
    example: TaskStatusEnum.DRAFT,
    enum: TaskStatusEnum,
  })
  status: TaskStatusEnum

  @ValidateNumber({ description: '优先级', example: 10 })
  priority: number

  @ValidateBoolean({ description: '启用状态', example: true })
  isEnabled: boolean

  @ValidateEnum({
    description: '领取模式',
    example: TaskClaimModeEnum.AUTO,
    enum: TaskClaimModeEnum,
  })
  claimMode: TaskClaimModeEnum

  @ValidateEnum({
    description: '完成模式',
    example: TaskCompleteModeEnum.AUTO,
    enum: TaskCompleteModeEnum,
  })
  completeMode: TaskCompleteModeEnum

  @ValidateNumber({ description: '完成目标次数', example: 1 })
  targetCount: number

  @ValidateJson({
    description: '奖励配置',
    example: '{"points":10,"experience":5,"badgeCodes":["newbie"]}',
    required: false,
  })
  rewardConfig?: string

  @ValidateDate({
    description: '发布开始时间',
    example: '2026-02-13T00:00:00.000Z',
    required: false,
  })
  publishStartAt?: Date

  @ValidateDate({
    description: '发布结束时间',
    example: '2026-02-28T23:59:59.000Z',
    required: false,
  })
  publishEndAt?: Date

  @ValidateJson({
    description: '周期规则',
    example: '{"type":"daily","resetAt":"00:00"}',
    required: false,
  })
  repeatRule?: string

  @ValidateNumber({ description: '创建人ID', example: 1, required: false })
  createdById?: number

  @ValidateNumber({ description: '更新人ID', example: 1, required: false })
  updatedById?: number
}

export class CreateTaskDto extends OmitType(BaseTaskDto, [
  ...OMIT_BASE_FIELDS,
  'createdById',
  'updatedById',
]) {}

export class UpdateTaskDto extends IntersectionType(
  PartialType(CreateTaskDto),
  IdDto,
) {}

export class UpdateTaskStatusDto extends IntersectionType(
  IdDto,
  PartialType(
    PickType(BaseTaskDto, ['status', 'isEnabled'] as const),
  ),
) {}

export class QueryTaskDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskDto, ['title', 'status', 'type', 'isEnabled'] as const),
  ),
) {}

export class BaseTaskAssignmentDto extends BaseDto {
  @ValidateNumber({ description: '任务ID', example: 1 })
  taskId: number

  @ValidateNumber({ description: '用户ID', example: 10001 })
  userId: number

  @ValidateString({ description: '周期实例键', example: '2026-02-13' })
  cycleKey: string

  @ValidateEnum({
    description: '任务状态',
    example: TaskAssignmentStatusEnum.IN_PROGRESS,
    enum: TaskAssignmentStatusEnum,
  })
  status: TaskAssignmentStatusEnum

  @ValidateNumber({ description: '当前进度', example: 0 })
  progress: number

  @ValidateNumber({ description: '目标进度', example: 1 })
  target: number

  @ValidateDate({
    description: '领取时间',
    example: '2026-02-13T00:00:00.000Z',
    required: false,
  })
  claimedAt?: Date

  @ValidateDate({
    description: '完成时间',
    example: '2026-02-13T08:00:00.000Z',
    required: false,
  })
  completedAt?: Date

  @ValidateDate({
    description: '过期时间',
    example: '2026-02-14T00:00:00.000Z',
    required: false,
  })
  expiredAt?: Date

  @ValidateJson({
    description: '任务快照',
    example: '{"title":"完善个人资料","rewardConfig":{"points":10}}',
    required: false,
  })
  taskSnapshot?: string

  @ValidateJson({
    description: '上下文',
    example: '{"source":"app"}',
    required: false,
  })
  context?: string
}

export class QueryTaskAssignmentDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseTaskAssignmentDto, ['taskId', 'userId', 'status'] as const),
  ),
) {}

export class QueryAppTaskDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTaskDto, ['type'] as const)),
) {}

export class QueryMyTaskDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseTaskAssignmentDto, ['status'] as const)),
) {
  @ValidateEnum({
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
  @ValidateNumber({ description: '任务ID', example: 1 })
  taskId: number

  @ValidateNumber({ description: '进度增量', example: 1 })
  delta: number

  @ValidateJson({
    description: '变更上下文',
    example: '{"action":"post_comment"}',
    required: false,
  })
  context?: string
}

export class TaskCompleteDto extends PickType(BaseTaskAssignmentDto, [
  'taskId',
] as const) {}
