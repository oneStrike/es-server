import {
  BaseCheckInPlanDto,
  BaseCheckInRecordDto,
  BaseCheckInStreakRewardGrantDto,
  BaseCheckInStreakRewardRuleDto,
  CheckInRepairTargetTypeEnum,
} from '@libs/growth/check-in'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

class CheckInGrantStatusFilterDto extends PartialType(
  PickType(BaseCheckInStreakRewardGrantDto, ['grantStatus'] as const),
) {}

class OptionalRecordIdDto {
  @NumberProperty({
    description: '签到记录ID',
    example: 100,
    required: false,
  })
  recordId?: number
}

class OptionalGrantIdDto {
  @NumberProperty({
    description: '连续奖励发放事实ID',
    example: 200,
    required: false,
  })
  grantId?: number
}

class AdminCheckInPlanBaseResponseDto extends PickType(BaseCheckInPlanDto, [
  'id',
  'createdAt',
  'updatedAt',
  'planCode',
  'planName',
  'status',
  'isEnabled',
  'cycleType',
  'cycleAnchorDate',
  'allowMakeupCountPerCycle',
  'baseRewardConfig',
  'version',
  'publishStartAt',
  'publishEndAt',
] as const) {}

class AdminCheckInReconciliationRecordBaseDto extends PickType(
  BaseCheckInRecordDto,
  [
    'createdAt',
    'userId',
    'planId',
    'cycleId',
    'signDate',
    'recordType',
    'rewardStatus',
    'rewardResultType',
    'baseRewardLedgerIds',
    'lastRewardError',
  ] as const,
) {}

export class CreateCheckInStreakRewardRuleDto extends OmitType(
  BaseCheckInStreakRewardRuleDto,
  [
    ...OMIT_BASE_FIELDS,
    'planId',
    'planVersion',
    'deletedAt',
  ] as const,
) {}

export class CreateCheckInPlanDto extends OmitType(BaseCheckInPlanDto, [
  ...OMIT_BASE_FIELDS,
  'version',
  'createdById',
  'updatedById',
  'deletedAt',
] as const) {
  @ArrayProperty({
    description: '连续签到奖励规则列表',
    itemClass: CreateCheckInStreakRewardRuleDto,
    itemType: 'object',
    required: false,
  })
  streakRewardRules?: CreateCheckInStreakRewardRuleDto[]
}

export class UpdateCheckInPlanDto extends IntersectionType(
  PartialType(CreateCheckInPlanDto),
  IdDto,
) {}

export class UpdateCheckInPlanStatusDto extends IntersectionType(
  IdDto,
  PartialType(PickType(BaseCheckInPlanDto, ['status', 'isEnabled'] as const)),
) {}

export class QueryCheckInPlanDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseCheckInPlanDto, [
      'planCode',
      'planName',
      'status',
      'isEnabled',
    ] as const),
  ),
) {}

export class AdminCheckInStreakRewardRuleItemDto extends PickType(
  BaseCheckInStreakRewardRuleDto,
  [
    'id',
    'createdAt',
    'updatedAt',
    'planId',
    'planVersion',
    'ruleCode',
    'streakDays',
    'rewardConfig',
    'repeatable',
    'status',
  ] as const,
) {}

export class AdminCheckInPlanPageResponseDto extends AdminCheckInPlanBaseResponseDto {
  @NumberProperty({
    description: '当前版本连续奖励规则数量',
    example: 3,
    validation: false,
  })
  ruleCount!: number

  @NumberProperty({
    description: '当前活跃周期实例数量',
    example: 123,
    validation: false,
  })
  activeCycleCount!: number

  @NumberProperty({
    description: '待补偿奖励数量',
    example: 4,
    validation: false,
  })
  pendingRewardCount!: number
}

export class AdminCheckInPlanDetailResponseDto extends AdminCheckInPlanPageResponseDto {
  @ArrayProperty({
    description: '当前版本连续奖励规则列表',
    itemClass: AdminCheckInStreakRewardRuleItemDto,
    itemType: 'object',
    validation: false,
  })
  streakRewardRules!: AdminCheckInStreakRewardRuleItemDto[]
}

export class QueryCheckInReconciliationDto extends IntersectionType(
  PageDto,
  IntersectionType(
    PartialType(
      PickType(BaseCheckInRecordDto, [
        'planId',
        'userId',
        'cycleId',
        'rewardStatus',
      ] as const),
    ),
    CheckInGrantStatusFilterDto,
  ),
  IntersectionType(OptionalRecordIdDto, OptionalGrantIdDto),
) {}

export class AdminCheckInGrantItemDto extends PickType(
  BaseCheckInStreakRewardGrantDto,
  [
    'id',
    'ruleId',
    'triggerSignDate',
    'grantStatus',
    'grantResultType',
    'ledgerIds',
    'lastGrantError',
  ] as const,
) {}

export class AdminCheckInReconciliationPageResponseDto extends AdminCheckInReconciliationRecordBaseDto {
  @NumberProperty({
    description: '签到记录ID',
    example: 100,
    validation: false,
  })
  recordId!: number

  @ArrayProperty({
    description: '关联的连续奖励发放列表',
    itemClass: AdminCheckInGrantItemDto,
    itemType: 'object',
    validation: false,
  })
  grants!: AdminCheckInGrantItemDto[]
}

export class RepairCheckInRewardDto extends IntersectionType(
  OptionalRecordIdDto,
  OptionalGrantIdDto,
) {
  @EnumProperty({
    description: '补偿目标类型',
    example: CheckInRepairTargetTypeEnum.RECORD_REWARD,
    enum: CheckInRepairTargetTypeEnum,
  })
  targetType!: CheckInRepairTargetTypeEnum
}

export class RepairCheckInRewardResponseDto {
  @EnumProperty({
    description: '补偿目标类型',
    example: CheckInRepairTargetTypeEnum.RECORD_REWARD,
    enum: CheckInRepairTargetTypeEnum,
    validation: false,
  })
  targetType!: CheckInRepairTargetTypeEnum

  @NumberProperty({
    description: '签到记录ID',
    example: 100,
    required: false,
    validation: false,
  })
  recordId?: number

  @NumberProperty({
    description: '连续奖励发放事实ID',
    example: 200,
    required: false,
    validation: false,
  })
  grantId?: number

  @BooleanProperty({
    description: '是否补偿成功',
    example: true,
    validation: false,
  })
  success!: boolean
}
