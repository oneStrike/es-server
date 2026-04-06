import { QueryUserBadgeDto } from '@libs/growth/badge'
import { GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION } from '@libs/growth/event-definition'
import { BaseUserExperienceRecordDto } from '@libs/growth/experience'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { BaseGrowthLedgerRecordDto } from '@libs/growth/growth-ledger'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule'
import { BaseUserPointRecordDto } from '@libs/growth/point'
import {
  DateProperty,
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
import {
  APP_USER_MANUAL_OPERATION_KEY_REGEX,
  AppUserDeletedScopeEnum,
} from '../app-user.constant'
import { BaseAppUserCountDto } from './base-app-user-count.dto'
import { BaseAppUserDto } from './base-app-user.dto'

class AdminAppUserManualOperationDto extends UserIdDto {
  @RegexProperty({
    description: '人工操作稳定键，用于重试复用同一次补发请求',
    example: 'manual-growth-20260328-001',
    regex: APP_USER_MANUAL_OPERATION_KEY_REGEX,
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

export class AdminAppUserCountDto extends OmitType(BaseAppUserCountDto, [
  'userId',
  'createdAt',
  'updatedAt',
] as const) {}

export class AdminAppUserPointStatsDto {
  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  currentPoints!: number

  @NumberProperty({
    description: '今日获得积分',
    example: 15,
    validation: false,
  })
  todayEarned!: number

  @NumberProperty({
    description: '今日消耗积分',
    example: 5,
    validation: false,
  })
  todayConsumed!: number
}

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
    required: false,
    validation: false,
    nullable: false,
  })
  level!: AdminAppUserLevelDto

  @NestedProperty({
    description: '下一等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
    nullable: false,
  })
  nextLevel!: AdminAppUserLevelDto

  @NumberProperty({
    description: '距离下一等级的经验差值',
    example: 50,
    required: false,
    validation: false,
  })
  gapToNextLevel?: number
}

export class AdminAppUserPageItemDto extends BaseAppUserDto {
  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: false,
    validation: false,
  })
  levelName?: string

  @NestedProperty({
    description: '用户计数',
    type: AdminAppUserCountDto,
    validation: false,
    nullable: false,
  })
  counts!: AdminAppUserCountDto
}

export class AdminAppUserDetailDto extends BaseAppUserDto {
  @NestedProperty({
    description: '等级信息',
    type: AdminAppUserLevelDto,
    required: false,
    validation: false,
    nullable: false,
  })
  level!: AdminAppUserLevelDto

  @NestedProperty({
    description: '用户计数',
    type: AdminAppUserCountDto,
    required: false,
    validation: false,
    nullable: false,
  })
  counts!: AdminAppUserCountDto

  @NumberProperty({
    description: '已拥有徽章数量',
    example: 3,
    validation: false,
  })
  badgeCount!: number

  @NestedProperty({
    description: '积分统计',
    type: AdminAppUserPointStatsDto,
    validation: false,
    nullable: false,
  })
  pointStats!: AdminAppUserPointStatsDto

  @NestedProperty({
    description: '经验统计',
    type: AdminAppUserExperienceStatsDto,
    validation: false,
    nullable: false,
  })
  experienceStats!: AdminAppUserExperienceStatsDto
}

export class QueryAdminAppUserPageDto extends IntersectionType(
  PartialType(
    PickType(BaseAppUserDto, [
      'id',
      'account',
      'phoneNumber',
      'nickname',
      'emailAddress',
      'isEnabled',
      'status',
      'levelId',
    ] as const),
  ),
  PageDto,
) {
  @EnumProperty({
    description: '删除态筛选（0=未删除；1=已删除；2=全部）',
    enum: AppUserDeletedScopeEnum,
    example: AppUserDeletedScopeEnum.ACTIVE,
    required: false,
    default: AppUserDeletedScopeEnum.ACTIVE,
  })
  deletedScope?: AppUserDeletedScopeEnum

  @StringProperty({
    description: '最后登录开始时间',
    example: '2026-03-01',
    required: false,
    type: 'ISO8601',
  })
  lastLoginStartDate?: string

  @StringProperty({
    description: '最后登录结束时间',
    example: '2026-03-08',
    required: false,
    type: 'ISO8601',
  })
  lastLoginEndDate?: string
}

export class AdminAppUserFollowCountRepairResultDto extends IntersectionType(
  UserIdDto,
  PickType(AdminAppUserCountDto, [
    'followingUserCount',
    'followingAuthorCount',
    'followingSectionCount',
    'followersCount',
  ] as const),
) {}

export class CreateAdminAppUserDto extends IntersectionType(
  PickType(BaseAppUserDto, ['nickname'] as const),
  PartialType(
    PickType(BaseAppUserDto, [
      'phoneNumber',
      'emailAddress',
      'avatarUrl',
      'genderType',
      'birthDate',
      'isEnabled',
      'status',
      'signature',
      'bio',
    ] as const),
  ),
) {
  @StringProperty({
    description: '前端 RSA 加密后的密码',
    example: 'Base64EncodedCipherText',
    required: true,
    maxLength: 2000,
  })
  password!: string
}

export class ResetAdminAppUserPasswordDto extends PickType(BaseAppUserDto, [
  'id',
] as const) {
  @StringProperty({
    description: '前端 RSA 加密后的新密码',
    example: 'Base64EncodedCipherText',
    required: true,
    maxLength: 2000,
  })
  password!: string
}

export class UpdateAdminAppUserProfileDto extends IntersectionType(
  PickType(BaseAppUserDto, ['id'] as const),
  PartialType(
    PickType(BaseAppUserDto, [
      'nickname',
      'avatarUrl',
      'phoneNumber',
      'emailAddress',
      'genderType',
      'birthDate',
      'signature',
      'bio',
    ] as const),
  ),
) {}

export class UpdateAdminAppUserEnabledDto extends PickType(BaseAppUserDto, [
  'id',
  'isEnabled',
] as const) {}

export class UpdateAdminAppUserStatusDto extends PickType(BaseAppUserDto, [
  'id',
  'status',
] as const) {
  @StringProperty({
    description: '封禁或禁言原因',
    example: '违反社区规范',
    required: false,
    maxLength: 500,
  })
  banReason?: string

  @DateProperty({
    description: '封禁或禁言截止时间',
    example: '2026-03-08T10:00:00.000Z',
    required: false,
  })
  banUntil?: Date
}

export class AdminAppUserPointRecordDto extends OmitType(
  BaseUserPointRecordDto,
  [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'source',
    'updatedAt',
  ] as const,
) {
  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '变化前积分',
    example: 100,
    validation: false,
  })
  beforePoints!: number

  @NumberProperty({
    description: '变化后积分',
    example: 105,
    validation: false,
  })
  afterPoints!: number
}

export class AdminAppUserExperienceRecordDto extends OmitType(
  BaseUserExperienceRecordDto,
  [
    'assetType',
    'delta',
    'beforeValue',
    'afterValue',
    'bizKey',
    'source',
    'updatedAt',
  ] as const,
) {
  @NumberProperty({
    description: '经验值变化',
    example: 5,
    validation: false,
  })
  experience!: number

  @NumberProperty({
    description: '变化前经验值',
    example: 100,
    validation: false,
  })
  beforeExperience!: number

  @NumberProperty({
    description: '变化后经验值',
    example: 105,
    validation: false,
  })
  afterExperience!: number
}

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

export class AddAdminAppUserPointsDto extends AdminAppUserManualOperationDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '备注',
    example: '管理员发放积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class ConsumeAdminAppUserPointsDto extends AdminAppUserManualOperationDto {
  @NumberProperty({
    description: '消费积分数量',
    example: 10,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '关联目标类型',
    example: 3,
    required: false,
  })
  targetType?: number

  @NumberProperty({
    description: '关联目标ID',
    example: 1,
    required: false,
  })
  targetId?: number

  @NumberProperty({
    description: '关联兑换ID',
    example: 1,
    required: false,
  })
  exchangeId?: number

  @StringProperty({
    description: '备注',
    example: '管理员扣减积分',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class AddAdminAppUserExperienceDto extends AdminAppUserManualOperationDto {
  @EnumProperty({
    description: GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
  })
  ruleType!: GrowthRuleTypeEnum

  @StringProperty({
    description: '备注',
    example: '管理员发放经验',
    required: false,
    maxLength: 500,
  })
  remark?: string
}

export class AdminAppUserBadgeOperationResultDto extends UserIdDto {
  @NumberProperty({
    description: '徽章ID',
    example: 1,
    validation: false,
  })
  badgeId!: number
}
