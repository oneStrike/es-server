import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
import {
  CouponInstanceStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponSourceTypeEnum,
  CouponTypeEnum,
  CouponWorkflowType,
} from '../coupon.constant'

export class BaseCouponDefinitionDto extends BaseDto {
  @StringProperty({
    description: '券名称',
    example: '章节阅读券',
  })
  name!: string

  @EnumProperty({
    description: '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
  })
  couponType!: CouponTypeEnum

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
    description: '有效天数，后台创建的券定义必须为正整数',
    example: 7,
    min: 1,
    required: false,
    default: 7,
  })
  validDays?: number

  @NumberProperty({
    description: 'VIP 试用天数',
    example: 7,
    min: 1,
    required: false,
  })
  benefitDays?: number

  @NumberProperty({
    description: '补签次数',
    example: 1,
    min: 1,
    required: false,
  })
  benefitCount?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

class CouponDefinitionDefaultOutputFieldsDto {
  @NumberProperty({
    description: '折扣金额',
    example: 10,
    min: 0,
    validation: false,
  })
  discountAmount!: number

  @NumberProperty({
    description: '折扣率基点，10000=不打折',
    example: 9000,
    min: 0,
    max: 10000,
    validation: false,
  })
  discountRateBps!: number

  @NumberProperty({
    description: '单张券可用次数',
    example: 1,
    min: 1,
    validation: false,
  })
  usageLimit!: number

  @NumberProperty({
    description: '有效天数，后台创建的券定义必须为正整数',
    example: 7,
    min: 0,
    validation: false,
  })
  validDays!: number

  @NumberProperty({
    description: 'VIP 试用天数',
    example: 7,
    min: 0,
    validation: false,
  })
  benefitDays!: number

  @NumberProperty({
    description: '补签次数',
    example: 1,
    min: 0,
    validation: false,
  })
  benefitCount!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    validation: false,
  })
  isEnabled!: boolean
}

export class CouponDefinitionOutputDto extends IntersectionType(
  OmitType(BaseCouponDefinitionDto, [
    'discountAmount',
    'discountRateBps',
    'usageLimit',
    'validDays',
    'benefitDays',
    'benefitCount',
    'isEnabled',
  ] as const),
  CouponDefinitionDefaultOutputFieldsDto,
) {}

export class CreateCouponDefinitionDto extends PickType(
  BaseCouponDefinitionDto,
  [
    'name',
    'couponType',
    'discountAmount',
    'discountRateBps',
    'usageLimit',
    'validDays',
    'benefitDays',
    'benefitCount',
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

  @NumberProperty({
    description: '来源 ID',
    example: 1,
    required: false,
  })
  sourceId?: number

  @StringProperty({
    description: '后台发券操作幂等 ID，同一用户内相同操作 ID 重试不会重复发券',
    example: '6f3afcf4-607d-4c7b-b040-996d47fbbfdd',
    minLength: 1,
    maxLength: 120,
  })
  operationId!: string

  @NumberProperty({
    description: '发放数量',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  quantity?: number
}

export class CreateCouponGrantWorkflowDto {
  @NumberProperty({
    description: '券定义 ID',
    example: 1,
  })
  couponDefinitionId!: number

  @ArrayProperty({
    description: 'APP 用户 ID 列表',
    example: [1, 2, 3],
    itemType: 'number',
    minLength: 1,
  })
  userIds!: number[]

  @NumberProperty({
    description: '每个用户发放数量',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  quantity?: number

  @StringProperty({
    description: '后台批量发券操作幂等 ID',
    example: '6f3afcf4-607d-4c7b-b040-996d47fbbfdd',
    minLength: 1,
    maxLength: 120,
  })
  operationId!: string

  @StringProperty({
    description: '后台备注',
    example: '运营活动补发',
    maxLength: 500,
    required: false,
  })
  remark?: string
}

export class CouponGrantWorkflowTypeDto {
  @StringProperty({
    description: '后台批量发券工作流类型',
    example: CouponWorkflowType.ADMIN_GRANT_BATCH,
    validation: false,
  })
  workflowType!: typeof CouponWorkflowType.ADMIN_GRANT_BATCH
}

export class UserCouponItemDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
    validation: false,
  })
  userId!: number

  @NumberProperty({
    description: '券定义 ID',
    example: 1,
    validation: false,
  })
  couponDefinitionId!: number

  @EnumProperty({
    description: '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
    validation: false,
  })
  couponType!: CouponTypeEnum

  @EnumProperty({
    description: '券状态（1=可用；2=已用完；3=已过期；4=已撤销）',
    enum: CouponInstanceStatusEnum,
    example: CouponInstanceStatusEnum.AVAILABLE,
    validation: false,
  })
  status!: CouponInstanceStatusEnum

  @NumberProperty({
    description: '剩余次数',
    example: 1,
    validation: false,
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
    nullable: true,
    validation: false,
  })
  expiresAt!: Date | null
}

export class QueryUserCouponDto extends PageDto {
  @EnumProperty({
    description: '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=补签卡）',
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
    required: false,
  })
  targetId?: number

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
    validation: false,
  })
  couponInstanceId!: number

  @EnumProperty({
    description: '券类型（1=阅读券；2=折扣券；3=VIP 试用卡；4=补签卡）',
    enum: CouponTypeEnum,
    example: CouponTypeEnum.READING,
    validation: false,
  })
  couponType!: CouponTypeEnum

  @EnumProperty({
    description: '目标类型（1=漫画章节；2=小说章节；3=VIP；4=签到）',
    enum: CouponRedemptionTargetTypeEnum,
    example: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
    validation: false,
  })
  targetType!: CouponRedemptionTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
    required: true,
    nullable: true,
    validation: false,
  })
  targetId!: number | null
}
