import type {
  CheckInPlanSnapshot,
  CheckInRewardConfig,
} from '../check-in.type'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import {
  CheckInCycleTypeEnum,
  CheckInOperatorTypeEnum,
  CheckInPlanStatusEnum,
  CheckInRecordTypeEnum,
  CheckInRewardResultTypeEnum,
  CheckInRewardStatusEnum,
  CheckInStreakRewardRuleStatusEnum,
} from '../check-in.constant'

export class BaseCheckInPlanDto extends BaseDto {
  @StringProperty({
    description: '签到计划编码',
    example: 'daily-check-in',
    maxLength: 50,
  })
  planCode!: string

  @StringProperty({
    description: '签到计划名称',
    example: '每日签到',
    maxLength: 200,
  })
  planName!: string

  @EnumProperty({
    description: '签到计划状态',
    example: CheckInPlanStatusEnum.DRAFT,
    enum: CheckInPlanStatusEnum,
  })
  status!: CheckInPlanStatusEnum

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
  })
  isEnabled!: boolean

  @EnumProperty({
    description: '周期类型',
    example: CheckInCycleTypeEnum.WEEKLY,
    enum: CheckInCycleTypeEnum,
  })
  cycleType!: CheckInCycleTypeEnum

  @StringProperty({
    description: '周期锚点日期（date 语义）',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  cycleAnchorDate!: string

  @NumberProperty({
    description: '每周期允许补签次数',
    example: 2,
    min: 0,
  })
  allowMakeupCountPerCycle!: number

  @JsonProperty({
    description: '基础签到奖励配置，未配置时为 null',
    example: { points: 10, experience: 5 } satisfies CheckInRewardConfig,
    required: false,
  })
  baseRewardConfig?: CheckInRewardConfig | null

  @NumberProperty({
    description: '计划版本号',
    example: 1,
    validation: false,
  })
  version!: number

  @DateProperty({
    description: '发布时间开始时间',
    example: '2026-04-01T00:00:00.000Z',
    required: false,
  })
  publishStartAt?: Date | null

  @DateProperty({
    description: '发布时间结束时间',
    example: '2026-05-01T00:00:00.000Z',
    required: false,
  })
  publishEndAt?: Date | null

  @NumberProperty({
    description: '创建人ID',
    example: 1,
    required: false,
    validation: false,
  })
  createdById?: number | null

  @NumberProperty({
    description: '更新人ID',
    example: 1,
    required: false,
    validation: false,
  })
  updatedById?: number | null

  @DateProperty({
    description: '删除时间',
    example: '2026-04-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}

export class BaseCheckInCycleDto extends BaseDto {
  @NumberProperty({ description: '用户ID', example: 10001 })
  userId!: number

  @NumberProperty({ description: '签到计划ID', example: 1 })
  planId!: number

  @StringProperty({
    description: '周期键',
    example: 'week-2026-03-30',
    maxLength: 32,
  })
  cycleKey!: string

  @StringProperty({
    description: '周期开始日期（date 语义）',
    example: '2026-03-30',
    type: 'ISO8601',
  })
  cycleStartDate!: string

  @StringProperty({
    description: '周期结束日期（date 语义）',
    example: '2026-04-05',
    type: 'ISO8601',
  })
  cycleEndDate!: string

  @NumberProperty({
    description: '已签天数',
    example: 3,
    validation: false,
  })
  signedCount!: number

  @NumberProperty({
    description: '已使用补签次数',
    example: 1,
    validation: false,
  })
  makeupUsedCount!: number

  @NumberProperty({
    description: '当前连续签到天数',
    example: 3,
    validation: false,
  })
  currentStreak!: number

  @StringProperty({
    description: '最近签到日期（date 语义）',
    example: '2026-04-01',
    required: false,
    type: 'ISO8601',
    validation: false,
  })
  lastSignedDate?: string | null

  @NumberProperty({
    description: '周期快照版本',
    example: 1,
    validation: false,
  })
  planSnapshotVersion!: number

  @JsonProperty({
    description: '周期快照',
    example: {
      id: 1,
      planCode: 'daily-check-in',
      planName: '每日签到',
      cycleType: CheckInCycleTypeEnum.WEEKLY,
      cycleAnchorDate: '2026-04-01',
      allowMakeupCountPerCycle: 2,
      version: 1,
      streakRewardRules: [],
    } satisfies CheckInPlanSnapshot,
    validation: false,
  })
  planSnapshot!: CheckInPlanSnapshot

  @NumberProperty({
    description: '乐观锁版本号',
    example: 0,
    validation: false,
  })
  version!: number
}

export class BaseCheckInRecordDto extends BaseDto {
  @NumberProperty({ description: '用户ID', example: 10001 })
  userId!: number

  @NumberProperty({ description: '签到计划ID', example: 1 })
  planId!: number

  @NumberProperty({ description: '周期实例ID', example: 12 })
  cycleId!: number

  @StringProperty({
    description: '签到日期（date 语义）',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  signDate!: string

  @EnumProperty({
    description: '签到类型',
    example: CheckInRecordTypeEnum.NORMAL,
    enum: CheckInRecordTypeEnum,
  })
  recordType!: CheckInRecordTypeEnum

  @EnumProperty({
    description: '基础奖励状态',
    example: CheckInRewardStatusEnum.PENDING,
    enum: CheckInRewardStatusEnum,
    required: false,
  })
  rewardStatus?: CheckInRewardStatusEnum | null

  @EnumProperty({
    description: '基础奖励结果类型',
    example: CheckInRewardResultTypeEnum.APPLIED,
    enum: CheckInRewardResultTypeEnum,
    required: false,
  })
  rewardResultType?: CheckInRewardResultTypeEnum | null

  @StringProperty({
    description: '签到事实业务幂等键',
    example: 'checkin:record:plan:1:cycle:week-2026-03-30:user:9:date:2026-04-01',
    maxLength: 180,
    validation: false,
  })
  bizKey!: string

  @ArrayProperty({
    description: '基础奖励账本记录 ID 列表',
    itemType: 'number',
    example: [101, 102],
    validation: false,
  })
  baseRewardLedgerIds!: number[]

  @EnumProperty({
    description: '操作来源类型',
    example: CheckInOperatorTypeEnum.USER,
    enum: CheckInOperatorTypeEnum,
  })
  operatorType!: CheckInOperatorTypeEnum

  @StringProperty({
    description: '备注',
    example: '管理员补偿',
    required: false,
    maxLength: 500,
    validation: false,
  })
  remark?: string | null

  @StringProperty({
    description: '最近一次基础奖励失败原因',
    example: '签到基础奖励发放失败',
    required: false,
    maxLength: 500,
    validation: false,
  })
  lastRewardError?: string | null

  @JsonProperty({
    description: '签到上下文',
    example: { source: 'app' },
    required: false,
    validation: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '最近一次基础奖励结算时间',
    example: '2026-04-01T00:01:00.000Z',
    required: false,
    validation: false,
  })
  rewardSettledAt?: Date | null
}

export class BaseCheckInStreakRewardRuleDto extends BaseDto {
  @NumberProperty({ description: '签到计划ID', example: 1 })
  planId!: number

  @NumberProperty({
    description: '归属计划版本号',
    example: 1,
    validation: false,
  })
  planVersion!: number

  @StringProperty({
    description: '规则编码',
    example: 'streak-7',
    maxLength: 50,
  })
  ruleCode!: string

  @NumberProperty({
    description: '连续签到阈值天数',
    example: 7,
    min: 1,
  })
  streakDays!: number

  @JsonProperty({
    description: '连续奖励配置',
    example: { points: 70 } satisfies CheckInRewardConfig,
  })
  rewardConfig!: CheckInRewardConfig

  @BooleanProperty({
    description: '是否允许重复领取',
    example: false,
    default: false,
  })
  repeatable!: boolean

  @EnumProperty({
    description: '规则状态',
    example: CheckInStreakRewardRuleStatusEnum.ENABLED,
    enum: CheckInStreakRewardRuleStatusEnum,
  })
  status!: CheckInStreakRewardRuleStatusEnum

  @NumberProperty({
    description: '排序值',
    example: 10,
    min: 0,
  })
  sortOrder!: number

  @DateProperty({
    description: '删除时间',
    example: '2026-04-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  deletedAt?: Date | null
}

export class BaseCheckInStreakRewardGrantDto extends BaseDto {
  @NumberProperty({ description: '用户ID', example: 10001 })
  userId!: number

  @NumberProperty({ description: '签到计划ID', example: 1 })
  planId!: number

  @NumberProperty({ description: '周期实例ID', example: 12 })
  cycleId!: number

  @NumberProperty({ description: '连续奖励规则ID', example: 5 })
  ruleId!: number

  @StringProperty({
    description: '触发连续奖励的签到日期（date 语义）',
    example: '2026-04-01',
    type: 'ISO8601',
  })
  triggerSignDate!: string

  @EnumProperty({
    description: '连续奖励发放状态',
    example: CheckInRewardStatusEnum.PENDING,
    enum: CheckInRewardStatusEnum,
  })
  grantStatus!: CheckInRewardStatusEnum

  @EnumProperty({
    description: '连续奖励发放结果类型',
    example: CheckInRewardResultTypeEnum.APPLIED,
    enum: CheckInRewardResultTypeEnum,
    required: false,
  })
  grantResultType?: CheckInRewardResultTypeEnum | null

  @StringProperty({
    description: '连续奖励发放事实幂等键',
    example: 'checkin:grant:plan:1:cycle:12:rule:5:user:9:date:2026-04-01',
    maxLength: 200,
    validation: false,
  })
  bizKey!: string

  @ArrayProperty({
    description: '连续奖励账本记录 ID 列表',
    itemType: 'number',
    example: [201],
    validation: false,
  })
  ledgerIds!: number[]

  @StringProperty({
    description: '最近一次连续奖励失败原因',
    example: '连续奖励发放失败',
    required: false,
    maxLength: 500,
    validation: false,
  })
  lastGrantError?: string | null

  @NumberProperty({
    description: '发放事实对应的计划快照版本',
    example: 1,
    validation: false,
  })
  planSnapshotVersion!: number

  @JsonProperty({
    description: '连续奖励上下文',
    example: { triggeredByRecordId: 10 },
    required: false,
    validation: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '最近一次连续奖励结算时间',
    example: '2026-04-01T00:02:00.000Z',
    required: false,
    validation: false,
  })
  grantSettledAt?: Date | null
}
