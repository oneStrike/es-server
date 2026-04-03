import type { CheckInRewardConfig } from '../check-in.type'
import {
  BooleanProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, OMIT_BASE_FIELDS } from '@libs/platform/dto'
import { OmitType } from '@nestjs/swagger'
import { CheckInStreakRewardRuleStatusEnum } from '../check-in.constant'
import { CheckInRewardConfigDto } from './check-in-reward-config.dto'

export class BaseCheckInStreakRewardRuleDto extends BaseDto {
  @NumberProperty({ description: '签到计划 ID。', example: 1 })
  planId!: number

  @NumberProperty({
    description: '归属计划版本号。',
    example: 1,
    validation: false,
  })
  planVersion!: number

  @StringProperty({
    description: '规则编码。',
    example: 'streak-7',
    maxLength: 50,
  })
  ruleCode!: string

  @NumberProperty({
    description: '连续签到阈值天数。',
    example: 7,
    min: 1,
  })
  streakDays!: number

  @NestedProperty({
    description: '连续奖励配置。',
    type: CheckInRewardConfigDto,
    example: { points: 70 } satisfies CheckInRewardConfig,
  })
  rewardConfig!: CheckInRewardConfigDto

  @BooleanProperty({
    description:
      '是否允许重复领取；false=同周期同规则最多发放一次；true=命中阈值时可重复发放。',
    example: false,
    default: false,
  })
  repeatable!: boolean

  @EnumProperty({
    description: '规则状态（0=已停用；1=已启用）。',
    example: CheckInStreakRewardRuleStatusEnum.ENABLED,
    enum: CheckInStreakRewardRuleStatusEnum,
  })
  status!: CheckInStreakRewardRuleStatusEnum
}

export class CreateCheckInStreakRewardRuleDto extends OmitType(
  BaseCheckInStreakRewardRuleDto,
  [...OMIT_BASE_FIELDS, 'planId', 'planVersion'] as const,
) {}

export class CheckInStreakRewardRuleItemDto extends OmitType(
  BaseCheckInStreakRewardRuleDto,
  ['createdAt', 'updatedAt', 'planId', 'planVersion'] as const,
) {}
