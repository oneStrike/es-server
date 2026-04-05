import { ForumAppUserInfoDto } from '@libs/forum/profile'
import { UserExperienceRecordDto } from '@libs/growth/experience'
import { BaseUserLevelRuleDto } from '@libs/growth/level-rule'
import {
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'
import { PickType } from '@nestjs/swagger'

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
