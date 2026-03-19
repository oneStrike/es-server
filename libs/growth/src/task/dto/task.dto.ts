import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import {
  TaskAssignmentStatusEnum,
  TaskClaimModeEnum,
  TaskCompleteModeEnum,
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
  code: string

  @StringProperty({
    description: '任务标题',
    example: '完善个人资料',
    required: true,
    maxLength: 200,
  })
  title: string

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
    description: '任务类型',
    example: TaskTypeEnum.NEWBIE,
    enum: TaskTypeEnum,
  })
  type: TaskTypeEnum

  @EnumProperty({
    description: '任务状态',
    example: TaskStatusEnum.DRAFT,
    enum: TaskStatusEnum,
  })
  status: TaskStatusEnum

  @NumberProperty({ description: '优先级', example: 10 })
  priority: number

  @BooleanProperty({ description: '启用状态', example: true })
  isEnabled: boolean

  @EnumProperty({
    description: '领取模式',
    example: TaskClaimModeEnum.AUTO,
    enum: TaskClaimModeEnum,
  })
  claimMode: TaskClaimModeEnum

  @EnumProperty({
    description: '完成模式',
    example: TaskCompleteModeEnum.AUTO,
    enum: TaskCompleteModeEnum,
  })
  completeMode: TaskCompleteModeEnum

  @NumberProperty({ description: '完成目标次数', example: 1 })
  targetCount: number

  @JsonProperty({
    description: '奖励配置',
    example: { points: 10, experience: 5, badgeCodes: ['newbie'] },
    required: false,
  })
  rewardConfig?: Record<string, unknown> | null

  @DateProperty({
    description: '发布开始时间',
    example: '2026-02-13T00:00:00.000Z',
    required: false,
  })
  publishStartAt?: Date

  @DateProperty({
    description: '发布结束时间',
    example: '2026-02-28T23:59:59.000Z',
    required: false,
  })
  publishEndAt?: Date

  @JsonProperty({
    description: '周期规则',
    example: { type: 'daily', resetAt: '00:00' },
    required: false,
  })
  repeatRule?: Record<string, unknown> | null

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
  taskId: number

  @NumberProperty({ description: '用户ID', example: 10001 })
  userId: number

  @StringProperty({
    description: '周期实例键',
    example: '2026-02-13',
    required: true,
    maxLength: 32,
  })
  cycleKey: string

  @EnumProperty({
    description: '任务状态',
    example: TaskAssignmentStatusEnum.IN_PROGRESS,
    enum: TaskAssignmentStatusEnum,
  })
  status: TaskAssignmentStatusEnum

  @NumberProperty({ description: '当前进度', example: 0 })
  progress: number

  @NumberProperty({ description: '目标进度', example: 1 })
  target: number

  @NumberProperty({
    description: '乐观锁版本号',
    example: 0,
    required: true,
    default: 0,
    validation: false,
  })
  version: number

  @DateProperty({
    description: '领取时间',
    example: '2026-02-13T00:00:00.000Z',
    required: false,
  })
  claimedAt?: Date

  @DateProperty({
    description: '完成时间',
    example: '2026-02-13T08:00:00.000Z',
    required: false,
  })
  completedAt?: Date

  @DateProperty({
    description: '过期时间',
    example: '2026-02-14T00:00:00.000Z',
    required: false,
  })
  expiredAt?: Date

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
