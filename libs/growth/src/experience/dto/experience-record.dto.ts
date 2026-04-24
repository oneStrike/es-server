import { ForumAppUserInfoDto } from '@libs/forum/profile/dto/profile.dto'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule/dto/level-rule.dto'
import { EnumProperty, NestedProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'

import { PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { GrowthAssetTypeEnum } from '../../growth-ledger/growth-ledger.constant'
import {
  BaseGrowthRecordSharedDto,
} from '../../growth/dto/growth-shared.dto'

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
