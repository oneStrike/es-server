import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  CouponInstanceStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponSourceTypeEnum,
  CouponTargetScopeEnum,
  CouponTypeEnum,
} from '../coupon.constant'

export class BaseCouponDefinitionDto extends BaseDto {
  @StringProperty({
    description: '券名称',
    example: '章节阅读券',
  })
  name!: string

  @EnumProperty({
    description:
      '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
  })
  couponType!: CouponTypeEnum

  @EnumProperty({
    description: '适用目标范围（1=章节；2=VIP；3=广告；4=签到）',
    enum: CouponTargetScopeEnum,
    example: CouponTargetScopeEnum.CHAPTER,
  })
  targetScope!: CouponTargetScopeEnum

  @NumberProperty({
    description: '折扣金额',
    example: 10,
    min: 0,
    required: false,
    default: 0,
  })
  discountAmount?: number

  @NumberProperty({
    description: '折扣率基点，10000=不打折',
    example: 9000,
    min: 0,
    max: 10000,
    required: false,
    default: 10000,
  })
  discountRateBps?: number

  @NumberProperty({
    description: '单张券可用次数',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  usageLimit?: number

  @NumberProperty({
    description: '有效天数，0=按实例过期时间控制',
    example: 7,
    min: 0,
    required: false,
    default: 0,
  })
  validDays?: number

  @NumberProperty({
    description: '预算上限，0=不限制',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  budgetLimit?: number

  @ObjectProperty({
    description: '额外配置快照',
    example: { maxPrice: 100 },
    required: false,
  })
  configPayload?: Record<string, unknown> | null

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

export class CreateCouponDefinitionDto extends PickType(
  BaseCouponDefinitionDto,
  [
    'name',
    'couponType',
    'targetScope',
    'discountAmount',
    'discountRateBps',
    'usageLimit',
    'validDays',
    'budgetLimit',
    'configPayload',
    'isEnabled',
  ] as const,
) {}

export class UpdateCouponDefinitionDto extends IntersectionType(
  IdDto,
  PartialType(CreateCouponDefinitionDto),
) {}

export class QueryCouponDefinitionDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseCouponDefinitionDto, [
      'couponType',
      'targetScope',
      'isEnabled',
    ] as const),
  ),
) {}

export class GrantCouponDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
  })
  userId!: number

  @NumberProperty({
    description: '券定义 ID',
    example: 1,
  })
  couponDefinitionId!: number

  @EnumProperty({
    description: '券来源（1=任务发放；2=积分兑换；3=后台发放；4=购买补偿）',
    enum: CouponSourceTypeEnum,
    example: CouponSourceTypeEnum.ADMIN_GRANT,
  })
  sourceType!: CouponSourceTypeEnum

  @NumberProperty({
    description: '来源 ID',
    example: 1,
    required: false,
  })
  sourceId?: number
}

export class UserCouponItemDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
  })
  userId!: number

  @NumberProperty({
    description: '券定义 ID',
    example: 1,
  })
  couponDefinitionId!: number

  @EnumProperty({
    description:
      '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
  })
  couponType!: CouponTypeEnum

  @EnumProperty({
    description: '券状态（1=可用；2=已用完；3=已过期；4=已撤销）',
    enum: CouponInstanceStatusEnum,
    example: CouponInstanceStatusEnum.AVAILABLE,
  })
  status!: CouponInstanceStatusEnum

  @NumberProperty({
    description: '剩余次数',
    example: 1,
  })
  remainingUses!: number

  @StringProperty({
    description: '券名称',
    example: '章节阅读券',
    validation: false,
  })
  name!: string

  @DateProperty({
    description: '过期时间',
    example: '2026-06-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  expiresAt?: Date | null
}

export class QueryUserCouponDto extends PageDto {
  @EnumProperty({
    description:
      '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
    required: false,
  })
  couponType?: CouponTypeEnum
}

export class RedeemCouponBodyDto {
  @NumberProperty({
    description: '券实例 ID',
    example: 1,
  })
  couponInstanceId!: number

  @EnumProperty({
    description: '核销目标类型（1=漫画章节；2=小说章节；3=VIP；4=签到）',
    enum: CouponRedemptionTargetTypeEnum,
    example: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
  })
  targetType!: CouponRedemptionTargetTypeEnum

  @NumberProperty({
    description: '核销目标 ID',
    example: 1,
  })
  targetId!: number

  @StringProperty({
    description: '幂等业务键',
    example: 'coupon:1:chapter:1',
    required: false,
  })
  bizKey?: string
}

export class RedeemCouponCommandDto extends IntersectionType(
  RedeemCouponBodyDto,
  PickType(GrantCouponDto, ['userId'] as const),
) {}

export class CouponRedemptionResultDto extends BaseDto {
  @NumberProperty({
    description: '券实例 ID',
    example: 1,
  })
  couponInstanceId!: number

  @EnumProperty({
    description:
      '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=免广告卡；5=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
  })
  couponType!: CouponTypeEnum

  @EnumProperty({
    description: '目标类型（1=漫画章节；2=小说章节；3=VIP；4=签到）',
    enum: CouponRedemptionTargetTypeEnum,
    example: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
  })
  targetType!: CouponRedemptionTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
  })
  targetId!: number
}
