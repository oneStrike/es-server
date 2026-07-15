import { QueryUserBadgeDto } from '@libs/growth/badge/dto/user-badge-management.dto'
import {
  UserExperienceDeltaFieldsDto,
  UserPointDeltaFieldsDto,
} from '@libs/growth/dto/app-user-growth-shared.dto'
import { GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION } from '@libs/growth/event-definition/event-definition.constant'
import { BaseUserExperienceRecordDto } from '@libs/growth/experience/dto/experience-record.dto'
import { BaseGrowthLedgerRecordDto } from '@libs/growth/growth-ledger/dto/growth-ledger-record.dto'
import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { UserGrowthRuleActionDto } from '@libs/growth/growth/dto/growth-shared.dto'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto'
import { BaseUserPointRecordDto } from '@libs/growth/point/dto/point-record.dto'
import {
  EnumProperty,
  NestedProperty,
  NumberProperty,
  RegexProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { PageDto, UserIdDto } from '@libs/platform/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

const ADMIN_APP_USER_MANUAL_OPERATION_KEY_REGEX = /^[\w:-]{8,64}$/

class AdminAppUserManualGrowthOperationDto extends UserIdDto {
  @RegexProperty({
    description: '人工操作稳定键，用于重试复用同一次补发请求',
    example: 'manual-growth-20260328-001',
    regex: ADMIN_APP_USER_MANUAL_OPERATION_KEY_REGEX,
    message:
      'operationKey 只能包含字母、数字、冒号、下划线或短横线，长度为 8-64 位',
  })
  operationKey!: string
}

export class AdminAppUserLevelDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'requiredExperience',
] as const) {}

export class AdminAppUserExperienceStatsDto {
  @NumberProperty({
    description: '当前经验值',
    example: 350,
    validation: false,
  })
  currentExperience!: number

  @NumberProperty({
    description: '今日获得经验值',
    example: 20,
    validation: false,
  })
  todayEarned!: number

  @NestedProperty({
    description: '当前等级信息',
    type: AdminAppUserLevelDto,
    validation: false,
    nullable: true,
  })
  level!: AdminAppUserLevelDto | null

  @NestedProperty({
    description: '下一等级信息',
    type: AdminAppUserLevelDto,
    validation: false,
    nullable: true,
  })
  nextLevel!: AdminAppUserLevelDto | null

  @NumberProperty({
    description: '距离下一等级的经验差值',
    example: 50,
    nullable: true,
    validation: false,
  })
  gapToNextLevel!: number | null
}

export class AdminAppUserGrowthRuleActionDto extends IntersectionType(
  AdminAppUserManualGrowthOperationDto,
  PickType(UserGrowthRuleActionDto, ['operationNote'] as const),
) {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum
}

export class AdminAppUserPointRecordDto extends IntersectionType(
  OmitType(BaseUserPointRecordDto, [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'source',
    'updatedAt',
  ] as const),
  UserPointDeltaFieldsDto,
) {}

export class AdminAppUserExperienceRecordDto extends IntersectionType(
  OmitType(BaseUserExperienceRecordDto, [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'source',
    'updatedAt',
  ] as const),
  UserExperienceDeltaFieldsDto,
) {}

export class AdminAppUserGrowthLedgerRecordDto extends OmitType(
  BaseGrowthLedgerRecordDto,
  ['bizKey', 'source'] as const,
) {}

export class QueryAdminAppUserGrowthLedgerDto extends IntersectionType(
  UserIdDto,
  PageDto,
  PartialType(
    PickType(BaseGrowthLedgerRecordDto, [
      'assetType',
      'ruleId',
      'ruleType',
      'targetType',
      'targetId',
    ] as const),
  ),
) {}

export class QueryAdminAppUserBadgeDto extends IntersectionType(
  UserIdDto,
  QueryUserBadgeDto,
) {}

export class ConsumeAdminAppUserPointsDto extends AdminAppUserManualGrowthOperationDto {
  @NumberProperty({ description: '消费积分数量', example: 10, required: true })
  points!: number

  @NumberProperty({
    description:
      '关联目标类型（1=漫画；2=小说；3=漫画章节；4=小说章节；5=论坛主题）',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({ description: '关联目标ID', example: 1, required: false })
  targetId?: number

  @NumberProperty({ description: '关联兑换ID', example: 1, required: false })
  exchangeId?: number

  @StringProperty({
    description: '内部操作备注，仅用于审计与排障，不会作为用户账本说明文案',
    example: '管理员扣减积分，保留工单号',
    required: false,
    maxLength: 500,
  })
  operationNote?: string
}

export class AdminAppUserBadgeOperationResultDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
    validation: false,
  })
  userId!: number

  @NumberProperty({ description: '徽章ID', example: 1, validation: false })
  badgeId!: number
}
