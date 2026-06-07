import { ForumAppUserInfoDto } from '@libs/forum/profile/dto/profile.dto'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto'
import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GrowthAssetTypeEnum } from '../../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import {
  BaseGrowthRecordSharedDto,
} from '../../growth/dto/growth-shared.dto'

export enum ExperienceDeltaDirectionEnum {
  INCREASE = 1,
  DECREASE = 2,
}

export class UserExperienceRecordUserDto extends PickType(ForumAppUserInfoDto, [
  'id',
  'account',
  'nickname',
  'avatarUrl',
] as const) {}

export class BaseUserExperienceRecordDto extends BaseGrowthRecordSharedDto {
  @EnumProperty({
    description: '资产类型（1=积分；2=经验）',
    example: GrowthAssetTypeEnum.EXPERIENCE,
    required: true,
    enum: GrowthAssetTypeEnum,
  })
  assetType!: GrowthAssetTypeEnum

  @NumberProperty({
    description: '变更值',
    example: 5,
    required: true,
  })
  delta!: number

  @StringProperty({
    description: '账本来源（如 growth_rule、task_bonus、purchase）',
    example: 'growth_rule',
    required: false,
    maxLength: 40,
  })
  source?: string | null
}

export class QueryUserExperienceRecordPageDto extends PageDto {
  @NumberProperty({
    description: '单页大小，最大100，默认15',
    example: 15,
    max: 100,
    min: 1,
    required: false,
    default: 15,
  })
  pageSize?: number = undefined
}

export class QueryUserExperienceRecordFilterDto extends PartialType(
  PickType(BaseUserExperienceRecordDto, [
    'ruleId',
    'ruleType',
    'source',
    'targetType',
    'targetId',
    'bizKey',
  ] as const),
) {
  @BooleanProperty({
    description: '是否只看有关联规则的记录',
    example: true,
    required: false,
  })
  hasRule?: boolean

  @EnumProperty({
    description: '经验变更方向（1=增加；2=减少）',
    example: ExperienceDeltaDirectionEnum.INCREASE,
    enum: ExperienceDeltaDirectionEnum,
    required: false,
  })
  deltaDirection?: ExperienceDeltaDirectionEnum

  @NumberProperty({
    description: '最小经验变更值',
    example: 1,
    required: false,
  })
  minDelta?: number

  @NumberProperty({
    description: '最大经验变更值',
    example: 100,
    required: false,
  })
  maxDelta?: number
}

export class QueryUserExperienceRecordDto extends IntersectionType(
  QueryUserExperienceRecordPageDto,
  QueryUserExperienceRecordFilterDto,
) {
  @NumberProperty({
    description: '用户 ID；不传则按全局经验审计查询',
    example: 1,
    required: false,
    min: 1,
  })
  userId?: number
}

export class QueryScopedUserExperienceRecordDto extends IntersectionType(
  QueryUserExperienceRecordPageDto,
  QueryUserExperienceRecordFilterDto,
) {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number
}

export class QueryUserExperienceStatsDto extends PickType(
  BaseUserExperienceRecordDto,
  ['userId'] as const,
) {}

export class UserExperienceRecordDto extends PickType(
  BaseUserExperienceRecordDto,
  [
    'id',
    'userId',
    'ruleId',
    'ruleType',
    'source',
    'targetType',
    'targetId',
    'bizKey',
    'remark',
    'context',
    'createdAt',
  ] as const,
) {
  @NestedProperty({
    description: '经验所属用户摘要；用户已不存在时为 null',
    type: UserExperienceRecordUserDto,
    required: true,
    validation: false,
    nullable: true,
  })
  user!: UserExperienceRecordUserDto | null

  @NumberProperty({
    description: '关联的规则 ID；无规则时为 null',
    example: 1,
    nullable: true,
    validation: false,
  })
  ruleId!: number | null

  @EnumProperty({
    description:
      '成长记录关联的事件编码，直接复用统一事件定义编码；无事件时为 null',
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    enum: GrowthRuleTypeEnum,
    nullable: true,
    validation: false,
  })
  ruleType!: GrowthRuleTypeEnum | null

  @StringProperty({
    description: '账本来源；无来源时为 null',
    example: 'growth_rule',
    nullable: true,
    validation: false,
  })
  source!: string | null

  @NumberProperty({
    description: '关联目标类型；无目标时为 null',
    example: 3,
    nullable: true,
    validation: false,
  })
  targetType!: number | null

  @NumberProperty({
    description: '关联目标 ID；无目标时为 null',
    example: 1,
    nullable: true,
    validation: false,
  })
  targetId!: number | null

  @ObjectProperty({
    description: '扩展上下文（仅返回白名单解释字段）；无上下文时为 null',
    example: { taskId: 9, assignmentId: 18 },
    nullable: true,
    validation: false,
  })
  context!: Record<string, unknown> | null

  @StringProperty({
    description: '账本说明文案；无说明时为 null',
    example: '浏览漫画作品',
    nullable: true,
    validation: false,
  })
  remark!: string | null

  @DateProperty({
    description: '更新时间；账本记录无更新时间时为 null',
    example: null,
    nullable: true,
    validation: false,
  })
  updatedAt!: Date | null

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

export class UserExperienceLevelDto extends PickType(BaseUserLevelRuleDto, [
  'id',
  'name',
  'requiredExperience',
] as const) {}

export class UserExperienceRecordDetailDto extends UserExperienceRecordDto {
  @ObjectProperty({
    description: '完整诊断上下文；无上下文时为 null',
    example: { operationNote: '管理员补发奖励' },
    nullable: true,
    validation: false,
  })
  diagnosticContext!: Record<string, unknown> | null
}

export class UserExperienceStatsDto {
  @NumberProperty({
    description: '当前经验值',
    example: 1280,
    required: true,
    validation: false,
  })
  currentExperience!: number

  @NumberProperty({
    description: '今日获得经验值',
    example: 80,
    required: true,
    validation: false,
  })
  todayEarned!: number

  @NestedProperty({
    description: '当前等级信息',
    type: UserExperienceLevelDto,
    required: true,
    validation: false,
    nullable: true,
  })
  level!: UserExperienceLevelDto | null
}
