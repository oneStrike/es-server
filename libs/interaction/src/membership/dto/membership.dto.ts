import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { CreatePaymentOrderBaseDto } from '../../payment/dto/payment.dto'
import { PaymentSubscriptionModeEnum } from '../../payment/payment.constant'
import {
  MembershipBenefitGrantPolicyEnum,
  MembershipBenefitTypeEnum,
  MembershipPlanTierEnum,
} from '../membership.constant'

// ---------------------------------------------------------------------------
// Membership Benefit Definition
// ---------------------------------------------------------------------------

export class BaseMembershipBenefitDefinitionDto extends BaseDto {
  @StringProperty({
    description: '权益业务键，由服务端生成',
    example: 'daily_gift',
  })
  code!: string

  @StringProperty({
    description: '权益名称',
    example: '每日礼包',
  })
  name!: string

  @StringProperty({
    description: '权益图标资源键或 URL',
    example: 'calendar',
    default: '',
  })
  icon!: string

  @EnumProperty({
    description: '权益类型（1=纯展示；2=券发放）',
    enum: MembershipBenefitTypeEnum,
    example: MembershipBenefitTypeEnum.DISPLAY,
  })
  benefitType!: MembershipBenefitTypeEnum

  @StringProperty({
    description: '权益说明',
    example: '订阅期展示会员身份标识',
    default: '',
  })
  description!: string

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
  })
  isEnabled!: boolean
}

export class MembershipBenefitDefinitionOutputDto extends BaseMembershipBenefitDefinitionDto {}

export class CreateMembershipBenefitDefinitionDto extends IntersectionType(
  PickType(BaseMembershipBenefitDefinitionDto, [
    'name',
    'benefitType',
  ] as const),
  PartialType(
    PickType(BaseMembershipBenefitDefinitionDto, [
      'icon',
      'description',
      'sortOrder',
      'isEnabled',
    ] as const),
  ),
) {}

export class UpdateMembershipBenefitDefinitionDto extends IntersectionType(
  IdDto,
  PartialType(CreateMembershipBenefitDefinitionDto),
) {}

export class QueryMembershipBenefitDefinitionDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMembershipBenefitDefinitionDto, [
      'name',
      'benefitType',
      'isEnabled',
    ] as const),
  ),
) {}

// ---------------------------------------------------------------------------
// Membership Plan Benefit (base + input/output)
// ---------------------------------------------------------------------------

export class BaseMembershipPlanBenefitDto extends BaseDto {
  @NumberProperty({
    description: 'VIP 套餐 ID',
    example: 1,
  })
  planId!: number

  @NumberProperty({
    description: '会员权益定义 ID',
    example: 1,
  })
  benefitId!: number

  @EnumProperty({
    description: '发放策略（1=仅展示；2=开通时自动发放）',
    enum: MembershipBenefitGrantPolicyEnum,
    example: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
  })
  grantPolicy!: MembershipBenefitGrantPolicyEnum

  @ObjectProperty({
    description:
      '权益配置值：纯展示权益为空或展示元数据；券发放权益必须配置 couponDefinitionId/grantCount，可选 validDays 覆盖赠券有效期',
    example: { couponDefinitionId: 1, grantCount: 1 },
    nullable: true,
  })
  benefitValue!: Record<string, unknown> | null

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
  })
  isEnabled!: boolean
}

export class MembershipPlanBenefitOutputDto extends BaseMembershipPlanBenefitDto {}

export class MembershipPlanBenefitInputDto extends IntersectionType(
  PickType(BaseMembershipPlanBenefitDto, ['benefitId', 'grantPolicy'] as const),
  PartialType(
    PickType(BaseMembershipPlanBenefitDto, [
      'benefitValue',
      'sortOrder',
      'isEnabled',
    ] as const),
  ),
) {}

// ---------------------------------------------------------------------------
// Membership Plan
// ---------------------------------------------------------------------------

export class BaseMembershipPlanDto extends BaseDto {
  @StringProperty({
    description: '套餐名称',
    example: '月度 VIP',
  })
  name!: string

  @StringProperty({
    description: '套餐业务键，由服务端生成',
    example: 'vip_monthly',
  })
  planKey!: string

  @EnumProperty({
    description: '套餐层级（1=VIP；2=超级 VIP）',
    enum: MembershipPlanTierEnum,
    example: MembershipPlanTierEnum.VIP,
    default: MembershipPlanTierEnum.VIP,
  })
  tier!: MembershipPlanTierEnum

  @NumberProperty({
    description: '套餐售价，单位为分',
    example: 1800,
    min: 0,
  })
  priceAmount!: number

  @NumberProperty({
    description: '划线原价，单位为分',
    example: 3000,
    min: 0,
    default: 0,
  })
  originalPriceAmount!: number

  @NumberProperty({
    description: '有效天数',
    example: 30,
    min: 1,
  })
  durationDays!: number

  @StringProperty({
    description: '订阅页营销标签',
    example: '热门',
    default: '',
  })
  displayTag!: string

  @NumberProperty({
    description: '开通赠送积分数量',
    example: 340,
    min: 0,
    default: 0,
  })
  bonusPointAmount!: number

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
  })
  isEnabled!: boolean
}

export class MembershipPlanOutputDto extends BaseMembershipPlanDto {}

export class CreateMembershipPlanDto extends IntersectionType(
  PickType(BaseMembershipPlanDto, [
    'name',
    'priceAmount',
    'durationDays',
  ] as const),
  PartialType(
    PickType(BaseMembershipPlanDto, [
      'tier',
      'originalPriceAmount',
      'displayTag',
      'bonusPointAmount',
      'sortOrder',
      'isEnabled',
    ] as const),
  ),
) {
  @ArrayProperty({
    description: '套餐关联权益列表',
    itemClass: MembershipPlanBenefitInputDto,
    example: [
      {
        benefitId: 1,
        grantPolicy: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
        benefitValue: null,
        sortOrder: 0,
        isEnabled: true,
      },
    ],
    required: false,
    default: [],
  })
  benefits?: MembershipPlanBenefitInputDto[]
}

export class UpdateMembershipPlanDto extends IntersectionType(
  IdDto,
  PartialType(CreateMembershipPlanDto),
) {}

export class QueryMembershipPlanDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMembershipPlanDto, ['name', 'tier', 'isEnabled'] as const),
  ),
) {}

// ---------------------------------------------------------------------------
// Membership Plan Benefit (item + composition)
// ---------------------------------------------------------------------------

export class MembershipPlanBenefitItemDto extends MembershipPlanBenefitOutputDto {
  @NestedProperty({
    description: '权益定义',
    type: MembershipBenefitDefinitionOutputDto,
    validation: false,
  })
  benefit!: MembershipBenefitDefinitionOutputDto
}

class MembershipPlanBenefitsOutputDto {
  @ArrayProperty({
    description: '套餐关联权益列表',
    itemClass: MembershipPlanBenefitItemDto,
    example: [],
    required: true,
    default: [],
    validation: false,
  })
  benefits!: MembershipPlanBenefitItemDto[]
}

export class MembershipPlanItemDto extends IntersectionType(
  MembershipPlanOutputDto,
  MembershipPlanBenefitsOutputDto,
) {}

// ---------------------------------------------------------------------------
// Membership Page Config
// ---------------------------------------------------------------------------

export class BaseMembershipPageConfigDto extends BaseDto {
  @StringProperty({
    description: '页面业务键，由服务端生成',
    example: 'vip_subscription',
  })
  pageKey!: string

  @StringProperty({
    description: '页面标题',
    example: 'VIP会员',
  })
  title!: string

  @ArrayProperty({
    description: '会员说明条目',
    itemType: 'string',
    nullable: true,
  })
  memberNoticeItems!: string[] | null

  @StringProperty({
    description: '确认开通协议提示文案',
    example: '开通即同意《会员服务协议》和《隐私政策》',
    default: '',
  })
  checkoutAgreementText!: string

  @StringProperty({
    description: '支付按钮文案模板',
    example: '¥{price} 确认协议并开通',
    default: '',
  })
  submitButtonTemplate!: string

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    default: true,
  })
  isEnabled!: boolean
}

export class MembershipPageConfigOutputBaseDto extends BaseMembershipPageConfigDto {}

export class MembershipPageConfigAgreementIdsDto {
  @ArrayProperty({
    description: '关联协议 ID 列表，按输入顺序展示',
    itemType: 'number',
    required: false,
  })
  agreementIds?: number[] | null
}

export class MembershipPageConfigPlanIdsDto {
  @ArrayProperty({
    description: '绑定套餐 ID 列表，按输入顺序展示',
    itemType: 'number',
    required: false,
  })
  planIds?: number[] | null
}

export class MembershipPageConfigPlansDto {
  @ArrayProperty({
    description: '绑定套餐列表',
    itemClass: MembershipPlanOutputDto,
    required: true,
    validation: false,
  })
  plans!: MembershipPlanOutputDto[]
}

export class MembershipPageConfigRelationsDto extends IntersectionType(
  MembershipPageConfigAgreementIdsDto,
  MembershipPageConfigPlanIdsDto,
) {}

export class CreateMembershipPageConfigDto extends IntersectionType(
  PickType(BaseMembershipPageConfigDto, ['title'] as const),
  PartialType(
    PickType(BaseMembershipPageConfigDto, [
      'memberNoticeItems',
      'checkoutAgreementText',
      'submitButtonTemplate',
      'sortOrder',
      'isEnabled',
    ] as const),
  ),
  MembershipPageConfigRelationsDto,
) {}

export class UpdateMembershipPageConfigDto extends IntersectionType(
  IdDto,
  PartialType(CreateMembershipPageConfigDto),
) {}

export class QueryMembershipPageConfigDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMembershipPageConfigDto, [
      'pageKey',
      'title',
      'isEnabled',
    ] as const),
  ),
) {}

export class QueryVipSubscriptionPageDto extends PartialType(
  PickType(BaseMembershipPageConfigDto, ['pageKey'] as const),
) {}

// ---------------------------------------------------------------------------
// Payment / Subscription
// ---------------------------------------------------------------------------

export class CreateVipSubscriptionOrderDto extends CreatePaymentOrderBaseDto {
  @NumberProperty({
    description: 'VIP 套餐 ID',
    example: 1,
  })
  planId!: number

  @StringProperty({
    description: '订阅页业务键，不传时使用默认启用订阅页',
    example: 'vip_subscription',
    required: false,
  })
  pageKey?: string

  @EnumProperty({
    description: '订阅模式（1=一次性订阅，不传默认一次性）',
    enum: PaymentSubscriptionModeEnum,
    example: PaymentSubscriptionModeEnum.ONE_TIME,
    required: false,
    default: PaymentSubscriptionModeEnum.ONE_TIME,
  })
  subscriptionMode?: PaymentSubscriptionModeEnum
}

export class MembershipSubscriptionSummaryDto {
  @BooleanProperty({
    description: '是否拥有有效 VIP 订阅',
    example: true,
    validation: false,
  })
  isActive!: boolean

  @EnumProperty({
    description: '当前最高套餐层级（1=VIP；2=超级 VIP）',
    enum: MembershipPlanTierEnum,
    example: MembershipPlanTierEnum.VIP,
    nullable: true,
    validation: false,
  })
  tier!: MembershipPlanTierEnum | null

  @DateProperty({
    description: 'VIP 到期时间',
    nullable: true,
    validation: false,
  })
  expiresAt!: Date | null
}
