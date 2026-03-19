import {
  BaseAppUserInfoDto,
} from '@libs/forum'
import {
  BaseUserExperienceRecordDto,
  BaseUserLevelRuleDto,
} from '@libs/growth'
import {
  NestedProperty,
  NumberProperty,
} from '@libs/platform/decorators'

export class UserExperienceRecordDetailDto extends BaseUserExperienceRecordDto {
  @NestedProperty({
    description: '经验所属用户',
    type: BaseAppUserInfoDto,
    required: true,
    validation: false,
  })
  user!: BaseAppUserInfoDto
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
    type: BaseUserLevelRuleDto,
    required: false,
    validation: false,
  })
  level?: BaseUserLevelRuleDto
}
