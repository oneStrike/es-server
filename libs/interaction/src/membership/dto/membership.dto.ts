import { AgreementListItemDto } from '@libs/app-content/agreement/dto/agreement.dto'
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
import {
  ClientPlatformEnum,
  PaymentChannelEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
  ProviderEnvironmentEnum,
} from '../../payment/payment.constant'
import {
  MembershipAutoRenewAgreementStatusEnum,
  MembershipBenefitGrantPolicyEnum,
  MembershipBenefitTypeEnum,
  MembershipPlanTierEnum,
} from '../membership.constant'

export class MembershipPlanBenefitInputDto {
  @NumberProperty({
    description: '会员权益定义 ID',
    example: 1,
  })
  benefitId!: number

  @EnumProperty({
    description:
      '发放策略（1=仅展示；2=开通时自动发放；3=每日可领取；4=订阅期内持续生效；5=手动领取一次）',
    enum: MembershipBenefitGrantPolicyEnum,
    example: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
  })
  grantPolicy!: MembershipBenefitGrantPolicyEnum

  @ObjectProperty({
    description:
      '权益配置值，按权益类型使用闭集结构：券发放 couponDefinitionId/grantCount/validDays，道具 assetType/assetKey/grantCount/validDays，无广告 adScope/durationPolicy，优先看 contentScope/advanceHours',
    example: { couponDefinitionId: 1, grantCount: 1, validDays: 30 },
    required: false,
  })
  benefitValue?: Record<string, unknown> | null

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

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
    required: false,
    default: MembershipPlanTierEnum.VIP,
  })
  tier?: MembershipPlanTierEnum

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
    required: false,
    default: 0,
  })
  originalPriceAmount?: number

  @NumberProperty({
    description: '有效天数',
    example: 30,
    min: 1,
  })
  durationDays!: number

  @StringProperty({
    description: '订阅页营销标签',
    example: '热门',
    required: false,
    default: '',
  })
  displayTag?: string

  @NumberProperty({
    description: '开通赠送积分数量',
    example: 340,
    min: 0,
    required: false,
    default: 0,
  })
  bonusPointAmount?: number

  @BooleanProperty({
    description: '是否支持自动续费签约',
    example: true,
    required: false,
    default: false,
  })
  autoRenewEnabled?: boolean

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

export class CreateMembershipPlanDto extends PickType(BaseMembershipPlanDto, [
  'name',
  'tier',
  'priceAmount',
  'originalPriceAmount',
  'durationDays',
  'displayTag',
  'bonusPointAmount',
  'autoRenewEnabled',
  'sortOrder',
  'isEnabled',
] as const) {
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
    required: false,
    default: '',
  })
  icon?: string

  @EnumProperty({
    description:
      '权益类型（1=纯展示；2=券发放；3=道具/装扮发放；4=订阅权益；5=无广告策略；6=内容优先看策略）',
    enum: MembershipBenefitTypeEnum,
    example: MembershipBenefitTypeEnum.DISPLAY,
  })
  benefitType!: MembershipBenefitTypeEnum

  @StringProperty({
    description: '权益说明',
    example: '每日可领取会员礼包',
    required: false,
    default: '',
  })
  description?: string

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

export class CreateMembershipBenefitDefinitionDto extends PickType(
  BaseMembershipBenefitDefinitionDto,
  [
    'name',
    'icon',
    'benefitType',
    'description',
    'sortOrder',
    'isEnabled',
  ] as const,
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
    description:
      '发放策略（1=仅展示；2=开通时自动发放；3=每日可领取；4=订阅期内持续生效；5=手动领取一次）',
    enum: MembershipBenefitGrantPolicyEnum,
    example: MembershipBenefitGrantPolicyEnum.DISPLAY_ONLY,
  })
  grantPolicy!: MembershipBenefitGrantPolicyEnum

  @ObjectProperty({
    description:
      '权益配置值，按权益类型使用闭集结构：券发放 couponDefinitionId/grantCount/validDays，道具 assetType/assetKey/grantCount/validDays，无广告 adScope/durationPolicy，优先看 contentScope/advanceHours',
    example: { couponDefinitionId: 1, grantCount: 1, validDays: 30 },
    required: false,
  })
  benefitValue?: Record<string, unknown> | null

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

export class MembershipPlanBenefitItemDto extends BaseMembershipPlanBenefitDto {
  @NestedProperty({
    description: '权益定义',
    type: BaseMembershipBenefitDefinitionDto,
    validation: false,
  })
  benefit!: BaseMembershipBenefitDefinitionDto
}

export class MembershipPlanItemDto extends BaseMembershipPlanDto {
  @ArrayProperty({
    description: '套餐关联权益列表',
    itemClass: MembershipPlanBenefitItemDto,
    example: [],
    required: false,
    default: [],
    validation: false,
  })
  benefits!: MembershipPlanBenefitItemDto[]
}

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
    required: false,
  })
  memberNoticeItems?: string[] | null

  @StringProperty({
    description: '自动续费提示',
    example: '自动续费可随时取消',
    required: false,
    default: '',
  })
  autoRenewNotice?: string

  @StringProperty({
    description: '确认开通协议提示文案',
    example: '开通即同意《会员服务协议》和《隐私政策》',
    required: false,
    default: '',
  })
  checkoutAgreementText?: string

  @StringProperty({
    description: '支付按钮文案模板',
    example: '¥{price} 确认协议并开通',
    required: false,
    default: '',
  })
  submitButtonTemplate?: string

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

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

export class MembershipPageAgreementItemDto extends AgreementListItemDto {}

export class MembershipPageConfigAgreementsDto {
  @ArrayProperty({
    description: '关联协议列表',
    itemClass: MembershipPageAgreementItemDto,
    required: false,
  })
  agreements?: MembershipPageAgreementItemDto[]
}

export class MembershipPageConfigPlansDto {
  @ArrayProperty({
    description: '绑定套餐列表',
    itemClass: BaseMembershipPlanDto,
    required: false,
  })
  plans?: BaseMembershipPlanDto[]
}

export class MembershipPageConfigRelationsDto extends IntersectionType(
  MembershipPageConfigAgreementIdsDto,
  MembershipPageConfigPlanIdsDto,
) {}

export class MembershipPageConfigDisplayRelationsDto extends IntersectionType(
  MembershipPageConfigAgreementsDto,
  MembershipPageConfigPlansDto,
) {}

export class MembershipPageConfigItemDto extends IntersectionType(
  BaseMembershipPageConfigDto,
  MembershipPageConfigDisplayRelationsDto,
) {}

export class CreateMembershipPageConfigDto extends IntersectionType(
  PickType(BaseMembershipPageConfigDto, [
    'title',
    'memberNoticeItems',
    'autoRenewNotice',
    'checkoutAgreementText',
    'submitButtonTemplate',
    'sortOrder',
    'isEnabled',
  ] as const),
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
    description: '订阅模式（1=一次性订阅；2=自动续费签约首单）',
    enum: PaymentSubscriptionModeEnum,
    example: PaymentSubscriptionModeEnum.ONE_TIME,
    required: false,
    default: PaymentSubscriptionModeEnum.ONE_TIME,
  })
  subscriptionMode?: PaymentSubscriptionModeEnum
}

export class BaseMembershipAutoRenewAgreementDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
  })
  userId!: number

  @NumberProperty({
    description: 'VIP 套餐 ID',
    example: 1,
  })
  planId!: number

  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
  })
  channel!: PaymentChannelEnum

  @EnumProperty({
    description: '支付场景（1=App；2=H5；3=小程序）',
    enum: PaymentSceneEnum,
    example: PaymentSceneEnum.APP,
  })
  paymentScene!: PaymentSceneEnum

  @EnumProperty({
    description: '客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）',
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
  })
  platform!: ClientPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.PRODUCTION,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
  })
  clientAppKey!: string

  @NumberProperty({
    description: '支付 provider 配置 ID',
    example: 1,
  })
  providerConfigId!: number

  @NumberProperty({
    description: 'provider 配置版本快照',
    example: 1,
  })
  providerConfigVersion!: number

  @StringProperty({
    description: '密钥版本引用快照',
    example: 'kms://payment/wechat/default/v1',
  })
  credentialVersionRef!: string

  @StringProperty({
    description: '第三方签约协议号',
    example: 'provider-agreement-no',
  })
  agreementNo!: string

  @EnumProperty({
    description: '协议状态（1=有效；2=已取消；3=已过期；4=签约失败）',
    enum: MembershipAutoRenewAgreementStatusEnum,
    example: MembershipAutoRenewAgreementStatusEnum.ACTIVE,
  })
  status!: MembershipAutoRenewAgreementStatusEnum

  @DateProperty({
    description: '签约成功时间',
    required: false,
  })
  signedAt?: Date | null

  @DateProperty({
    description: '下次预计续扣时间',
    required: false,
  })
  nextRenewAt?: Date | null

  @DateProperty({
    description: '取消时间',
    required: false,
  })
  cancelledAt?: Date | null
}

export class QueryMembershipAutoRenewAgreementDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseMembershipAutoRenewAgreementDto, [
      'userId',
      'planId',
      'channel',
      'paymentScene',
      'status',
    ] as const),
  ),
) {}

export class MembershipSubscriptionSummaryDto {
  @BooleanProperty({
    description: '是否拥有有效 VIP 订阅',
    example: true,
  })
  isActive!: boolean

  @EnumProperty({
    description: '当前最高套餐层级（1=VIP；2=超级 VIP）',
    enum: MembershipPlanTierEnum,
    example: MembershipPlanTierEnum.VIP,
    required: false,
  })
  tier?: MembershipPlanTierEnum | null

  @DateProperty({
    description: 'VIP 到期时间',
    required: false,
  })
  expiresAt?: Date | null

  @BooleanProperty({
    description: '是否存在有效自动续费协议',
    example: false,
  })
  autoRenewActive!: boolean
}

export class VipSubscriptionPageDto {
  @NestedProperty({
    description: '页面配置',
    type: MembershipPageConfigItemDto,
    validation: false,
  })
  pageConfig!: MembershipPageConfigItemDto

  @ArrayProperty({
    description: '启用 VIP 套餐列表',
    itemClass: BaseMembershipPlanDto,
  })
  plans!: BaseMembershipPlanDto[]

  @ArrayProperty({
    description: '套餐权益列表',
    itemClass: MembershipPlanBenefitItemDto,
  })
  benefits!: MembershipPlanBenefitItemDto[]

  @NestedProperty({
    description: '当前用户订阅摘要',
    type: MembershipSubscriptionSummaryDto,
    validation: false,
  })
  currentSubscription!: MembershipSubscriptionSummaryDto
}
