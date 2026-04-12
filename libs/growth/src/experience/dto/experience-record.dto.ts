import { ForumAppUserInfoDto } from '@libs/forum/profile/dto/profile.dto';
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto';
import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { NestedProperty } from '@libs/platform/decorators/validate/nested-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { IdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION } from '../../event-definition/event-definition.doc';
import { GrowthAssetTypeEnum } from '../../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../../growth-rule.constant'

export class BaseUserExperienceRecordDto extends IdDto {
  @NumberProperty({
    description: '关联的用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '关联的规则ID',
    example: 1,
    required: false,
  })
  ruleId?: number | null

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

  @NumberProperty({
    description: '变更前余额',
    example: 100,
    required: true,
  })
  beforeValue!: number

  @NumberProperty({
    description: '变更后余额',
    example: 105,
    required: true,
  })
  afterValue!: number

  @StringProperty({
    description: '幂等业务键',
    example: 'experience:rule:ruleType=1|userId=1',
    required: true,
    maxLength: 120,
  })
  bizKey!: string

  @StringProperty({
    description: '账本来源（如 growth_rule、task_bonus、purchase）',
    example: 'growth_rule',
    required: false,
    maxLength: 40,
  })
  source?: string | null

  @EnumProperty({
    description: GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
    example: GrowthRuleTypeEnum.CREATE_TOPIC,
    required: false,
    enum: GrowthRuleTypeEnum,
  })
  ruleType?: GrowthRuleTypeEnum | null

  @NumberProperty({
    description: '关联目标类型',
    example: 3,
    required: false,
  })
  targetType?: number | null

  @NumberProperty({
    description: '关联目标ID',
    example: 1,
    required: false,
  })
  targetId?: number | null

  @StringProperty({
    description: '备注',
    example: '发表主题获得经验',
    required: false,
    maxLength: 500,
  })
  remark?: string | null

  @JsonProperty({
    description: '扩展上下文（仅返回白名单解释字段）',
    example: { taskId: 9, assignmentId: 18 },
    required: false,
  })
  context?: Record<string, unknown> | null

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
  })
  createdAt!: Date

  @DateProperty({
    description: '更新时间',
    example: '2026-03-19T12:00:00.000Z',
    required: false,
  })
  updatedAt?: Date
}

export class QueryUserExperienceRecordDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserExperienceRecordDto, ['ruleId'] as const)),
) {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number
}

export class AddUserExperienceDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    required: true,
  })
  userId!: number

  @EnumProperty({
    description: GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION,
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

export class UserExperienceRecordDto extends PickType(BaseUserExperienceRecordDto, [
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
  'updatedAt',
] as const) {
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
  @NestedProperty({
    description: '经验所属用户',
    type: ForumAppUserInfoDto,
    required: true,
    validation: false,
    nullable: false,
  })
  user!: ForumAppUserInfoDto
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
    required: false,
    validation: false,
    nullable: false,
  })
  level!: UserExperienceLevelDto
}
