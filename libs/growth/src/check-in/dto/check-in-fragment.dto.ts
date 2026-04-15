import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { NumberProperty } from '@libs/platform/decorators/validate/number-property'
import { PageDto } from '@libs/platform/dto/page.dto'
import { OmitType, PartialType } from '@nestjs/swagger'
import { CheckInRepairTargetTypeEnum } from '../check-in.constant'

export class CheckInPageNoDateDto extends OmitType(PageDto, [
  'startDate',
  'endDate',
] as const) {}

export class CheckInRecordIdDto {
  @NumberProperty({
    description: '签到记录 ID。',
    example: 100,
  })
  recordId!: number
}

export class OptionalCheckInRecordIdDto extends PartialType(
  CheckInRecordIdDto,
) {}

export class CheckInGrantIdDto {
  @NumberProperty({
    description: '连续奖励发放事实 ID。',
    example: 200,
  })
  grantId!: number
}

export class OptionalCheckInGrantIdDto extends PartialType(CheckInGrantIdDto) {}

export class CheckInRemainingMakeupCountDto {
  @NumberProperty({
    description: '当前周期剩余补签次数。',
    example: 1,
    validation: false,
  })
  remainingMakeupCount!: number
}

export class CheckInRepairTargetTypeDto {
  @EnumProperty({
    description: '补偿目标类型（1=基础签到奖励；2=连续签到奖励）',
    example: CheckInRepairTargetTypeEnum.RECORD_REWARD,
    enum: CheckInRepairTargetTypeEnum,
  })
  targetType!: CheckInRepairTargetTypeEnum
}
