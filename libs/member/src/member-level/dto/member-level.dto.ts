import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/base/dto'
import { IntersectionType, OmitType, PartialType } from '@nestjs/swagger'

export class BaseMemberLevelDto extends BaseDto {
  @ValidateString({
    required: true,
    description: '会员等级名称',
    minLength: 2,
    maxLength: 50,
    example: '白金会员',
  })
  name!: string

  @ValidateNumber({
    required: true,
    description: '会员等级',
    min: 1,
    max: 99,
    example: 1,
  })
  level!: number

  @ValidateNumber({
    required: true,
    description: '会员等级所需要的积分',
    min: 0,
    max: 999999999,
    example: 10,
  })
  points!: number

  @ValidateNumber({
    required: true,
    description: '会员等级所需要的登录天数',
    min: 0,
    max: 999999999,
    example: 10,
  })
  loginDays!: number

  @ValidateString({
    required: true,
    description: '会员等级图表',
    minLength: 2,
    maxLength: 200,
    example: 'https://example.com/icon.png',
  })
  icon!: string

  @ValidateString({
    required: true,
    description: '会员等级专属标识颜色',
    minLength: 2,
    maxLength: 20,
    example: '#FFD700',
  })
  color!: string

  @ValidateBoolean({
    required: true,
    description: '是否启用该等级',
    example: true,
  })
  isEnabled!: boolean

  @ValidateNumber({
    required: true,
    description: '黑名单上限',
    min: 0,
    max: 999999999,
    example: 10,
  })
  blacklistLimit!: number

  @ValidateNumber({
    required: true,
    description: '作品收藏上限',
    min: 0,
    max: 999999999,
    example: 100,
  })
  workCollectionLimit!: number

  @ValidateNumber({
    required: true,
    description: '积分购买折扣（0-1之间的小数，0表示不打折）',
    min: 0.0,
    max: 1.0,
    example: 0.0,
  })
  discount!: number

  @ValidateString({
    required: true,
    description: '会员等级描述',
    minLength: 10,
    maxLength: 500,
    example: '白金会员等级，享受更多权益',
  })
  description!: string

  @ValidateString({
    required: false,
    description: '备注信息',
    minLength: 2,
    maxLength: 255,
    example: '白金会员等级，积分达到1000000000时，即可升级为白金会员',
  })
  remark?: string
}

export class CreateMemberLevelDto extends OmitType(
  BaseMemberLevelDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateMemberLevelDto extends IntersectionType(
  PartialType(CreateMemberLevelDto),
  IdDto,
) {}
