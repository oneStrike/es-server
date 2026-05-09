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
import {
  AdProviderEnum,
  AdRewardStatusEnum,
  AdTargetScopeEnum,
  CouponInstanceStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponSourceTypeEnum,
  CouponTargetScopeEnum,
  CouponTypeEnum,
  MembershipAutoRenewAgreementStatusEnum,
  MembershipBenefitGrantPolicyEnum,
  MembershipBenefitTypeEnum,
  MembershipPlanTierEnum,
  MonetizationPlatformEnum,
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
  ProviderEnvironmentEnum,
} from '../monetization.constant'

export class BasePaymentProviderConfigDto extends BaseDto {
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
    enum: MonetizationPlatformEnum,
    example: MonetizationPlatformEnum.ANDROID,
  })
  platform!: MonetizationPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键，同一部署内区分多应用',
    example: 'default-app',
    required: false,
    default: '',
  })
  clientAppKey?: string

  @StringProperty({
    description: '配置名称，供后台识别',
    example: '微信 App 正式配置',
    required: false,
    default: '',
  })
  configName?: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'wx-app-id',
    required: false,
    default: '',
  })
  appId?: string

  @StringProperty({
    description: 'provider 商户 ID',
    example: 'mch-id',
    required: false,
    default: '',
  })
  mchId?: string

  @StringProperty({
    description: '通知回调地址',
    example: 'https://example.com/payment/notify',
    required: false,
    type: 'url',
  })
  notifyUrl?: string | null

  @StringProperty({
    description: 'H5 返回地址',
    example: 'https://example.com/pay/return',
    required: false,
    type: 'url',
  })
  returnUrl?: string | null

  @StringProperty({
    description: '自动续费签约通知地址',
    example: 'https://example.com/payment/agreement/notify',
    required: false,
    type: 'url',
  })
  agreementNotifyUrl?: string | null

  @ArrayProperty({
    description: 'H5 允许返回域名列表',
    itemType: 'string',
    required: false,
  })
  allowedReturnDomains?: string[] | null

  @NumberProperty({
    description: '证书模式（1=普通密钥；2=证书模式）',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  certMode?: number

  @StringProperty({
    description: '支付宝公钥引用',
    example: 'kms://payment/alipay/public-key/v1',
    required: false,
    maxLength: 160,
  })
  publicKeyRef?: string | null

  @StringProperty({
    description: '应用私钥引用',
    example: 'kms://payment/alipay/private-key/v1',
    required: false,
    maxLength: 160,
  })
  privateKeyRef?: string | null

  @StringProperty({
    description: '微信 APIv3 key 引用',
    example: 'kms://payment/wechat/api-v3-key/v1',
    required: false,
    maxLength: 160,
  })
  apiV3KeyRef?: string | null

  @StringProperty({
    description: '应用证书引用',
    example: 'kms://payment/app-cert/v1',
    required: false,
    maxLength: 160,
  })
  appCertRef?: string | null

  @StringProperty({
    description: '平台证书引用',
    example: 'kms://payment/platform-cert/v1',
    required: false,
    maxLength: 160,
  })
  platformCertRef?: string | null

  @StringProperty({
    description: '根证书引用',
    example: 'kms://payment/root-cert/v1',
    required: false,
    maxLength: 160,
  })
  rootCertRef?: string | null

  @NumberProperty({
    description: '配置版本',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  configVersion?: number

  @StringProperty({
    description: '密钥版本引用',
    example: 'kms://payment/alipay/default/v1',
    maxLength: 160,
  })
  credentialVersionRef!: string

  @ObjectProperty({
    description: '配置摘要，不包含明文密钥',
    example: { keyFingerprint: 'sha256:xxx' },
    required: false,
  })
  configMetadata?: Record<string, unknown> | null

  @BooleanProperty({
    description: '是否支持自动续费签约',
    example: false,
    required: false,
    default: false,
  })
  supportsAutoRenew?: boolean

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

export class CreatePaymentProviderConfigDto extends PickType(
  BasePaymentProviderConfigDto,
  [
    'channel',
    'paymentScene',
    'platform',
    'environment',
    'clientAppKey',
    'configName',
    'appId',
    'mchId',
    'notifyUrl',
    'returnUrl',
    'agreementNotifyUrl',
    'allowedReturnDomains',
    'certMode',
    'publicKeyRef',
    'privateKeyRef',
    'apiV3KeyRef',
    'appCertRef',
    'platformCertRef',
    'rootCertRef',
    'configVersion',
    'credentialVersionRef',
    'configMetadata',
    'supportsAutoRenew',
    'sortOrder',
    'isEnabled',
  ] as const,
) {}

export class UpdatePaymentProviderConfigDto extends IntersectionType(
  IdDto,
  PartialType(CreatePaymentProviderConfigDto),
) {}

export class QueryPaymentProviderConfigDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BasePaymentProviderConfigDto, [
      'channel',
      'paymentScene',
      'platform',
      'environment',
      'clientAppKey',
      'isEnabled',
    ] as const),
  ),
) {}

export class BaseAdProviderConfigDto extends BaseDto {
  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
  })
  provider!: AdProviderEnum

  @EnumProperty({
    description: '客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）',
    enum: MonetizationPlatformEnum,
    example: MonetizationPlatformEnum.ANDROID,
  })
  platform!: MonetizationPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    required: false,
    default: '',
  })
  clientAppKey?: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'pangle-app-id',
    required: false,
    default: '',
  })
  appId?: string

  @StringProperty({
    description: '广告位 key',
    example: 'reward-video-low-price',
  })
  placementKey!: string

  @EnumProperty({
    description: '目标范围（1=低价章节；2=新用户冷启动；3=运营白名单）',
    enum: AdTargetScopeEnum,
    example: AdTargetScopeEnum.LOW_PRICE_CHAPTER,
  })
  targetScope!: AdTargetScopeEnum

  @NumberProperty({
    description: '每日次数上限，0=不限制',
    example: 5,
    min: 0,
    required: false,
    default: 0,
  })
  dailyLimit?: number

  @NumberProperty({
    description: '配置版本',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  configVersion?: number

  @StringProperty({
    description: 'SSV 密钥版本引用',
    example: 'kms://ad/pangle/default/v1',
    maxLength: 160,
  })
  credentialVersionRef!: string

  @StringProperty({
    description: '广告回调地址',
    example: 'https://example.com/ad/callback',
    required: false,
    type: 'url',
  })
  callbackUrl?: string | null

  @ObjectProperty({
    description: '配置摘要，不包含明文密钥',
    example: { keyFingerprint: 'sha256:xxx' },
    required: false,
  })
  configMetadata?: Record<string, unknown> | null

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

export class CreateAdProviderConfigDto extends PickType(
  BaseAdProviderConfigDto,
  [
    'provider',
    'platform',
    'environment',
    'clientAppKey',
    'appId',
    'placementKey',
    'targetScope',
    'dailyLimit',
    'configVersion',
    'credentialVersionRef',
    'callbackUrl',
    'configMetadata',
    'sortOrder',
    'isEnabled',
  ] as const,
) {}

export class UpdateAdProviderConfigDto extends IntersectionType(
  IdDto,
  PartialType(CreateAdProviderConfigDto),
) {}

export class QueryAdProviderConfigDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAdProviderConfigDto, [
      'provider',
      'platform',
      'environment',
      'clientAppKey',
      'placementKey',
      'isEnabled',
    ] as const),
  ),
) {}

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

export class MembershipPageAgreementItemDto extends AgreementListItemDto {}

export class MembershipPageConfigAgreementsDto {
  @ArrayProperty({
    description: '关联协议列表',
    itemClass: MembershipPageAgreementItemDto,
    required: false,
  })
  agreements?: MembershipPageAgreementItemDto[]
}

export class MembershipPageConfigItemDto extends IntersectionType(
  BaseMembershipPageConfigDto,
  MembershipPageConfigAgreementsDto,
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
  MembershipPageConfigAgreementIdsDto,
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

export class BaseCurrencyPackageDto extends BaseDto {
  @StringProperty({
    description: '充值包业务键',
    example: 'coin_1000',
  })
  packageKey!: string

  @StringProperty({
    description: '充值包名称',
    example: '1000 阅读币',
  })
  name!: string

  @NumberProperty({
    description: '支付价格，单位为分',
    example: 1000,
    min: 0,
  })
  price!: number

  @NumberProperty({
    description: '发放虚拟币数量',
    example: 1000,
    min: 1,
  })
  currencyAmount!: number

  @NumberProperty({
    description: '赠送虚拟币数量',
    example: 100,
    min: 0,
    required: false,
    default: 0,
  })
  bonusAmount?: number

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

export class CreateCurrencyPackageDto extends PickType(BaseCurrencyPackageDto, [
  'packageKey',
  'name',
  'price',
  'currencyAmount',
  'bonusAmount',
  'sortOrder',
  'isEnabled',
] as const) {}

export class UpdateCurrencyPackageDto extends IntersectionType(
  IdDto,
  PartialType(CreateCurrencyPackageDto),
) {}

export class QueryCurrencyPackageDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseCurrencyPackageDto, ['name', 'isEnabled'] as const)),
) {}

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

export class CreatePaymentOrderBaseDto {
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
    enum: MonetizationPlatformEnum,
    example: MonetizationPlatformEnum.ANDROID,
  })
  platform!: MonetizationPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    required: false,
    default: '',
  })
  clientAppKey?: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'wx-app-id',
    required: false,
    default: '',
  })
  appId?: string

  @StringProperty({
    description: 'provider 商户 ID',
    example: 'mch-id',
    required: false,
    default: '',
  })
  mchId?: string

  @StringProperty({
    description: 'H5 返回地址',
    example: 'https://example.com/pay/return',
    required: false,
    type: 'url',
  })
  returnUrl?: string

  @StringProperty({
    description: '小程序 openId',
    example: 'openid',
    required: false,
  })
  openId?: string

  @StringProperty({
    description: '终端 IP',
    example: '127.0.0.1',
    required: false,
  })
  terminalIp?: string
}

export class CreateCurrencyRechargeOrderDto extends CreatePaymentOrderBaseDto {
  @NumberProperty({
    description: '充值包 ID',
    example: 1,
  })
  packageId!: number
}

export class CreateVipSubscriptionOrderDto extends CreatePaymentOrderBaseDto {
  @NumberProperty({
    description: 'VIP 套餐 ID',
    example: 1,
  })
  planId!: number

  @EnumProperty({
    description: '订阅模式（1=一次性订阅；2=自动续费签约首单）',
    enum: PaymentSubscriptionModeEnum,
    example: PaymentSubscriptionModeEnum.ONE_TIME,
    required: false,
    default: PaymentSubscriptionModeEnum.ONE_TIME,
  })
  subscriptionMode?: PaymentSubscriptionModeEnum
}

export class PaymentOrderResultDto extends BaseDto {
  @StringProperty({
    description: '站内订单号',
    example: 'PAY20260506000001',
  })
  orderNo!: string

  @EnumProperty({
    description: '订单业务类型（1=虚拟币充值；2=VIP 订阅）',
    enum: PaymentOrderTypeEnum,
    example: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
  })
  orderType!: PaymentOrderTypeEnum

  @EnumProperty({
    description: '订单状态（1=待支付；2=已支付；3=已关闭；4=退款中；5=已退款）',
    enum: PaymentOrderStatusEnum,
    example: PaymentOrderStatusEnum.PENDING,
  })
  status!: PaymentOrderStatusEnum

  @EnumProperty({
    description: '订阅模式（1=一次性；2=自动续费签约首单；3=自动续费代扣订单）',
    enum: PaymentSubscriptionModeEnum,
    example: PaymentSubscriptionModeEnum.ONE_TIME,
    required: false,
    default: PaymentSubscriptionModeEnum.ONE_TIME,
  })
  subscriptionMode?: PaymentSubscriptionModeEnum

  @NumberProperty({
    description: '应付金额，单位为分',
    example: 1000,
  })
  payableAmount!: number

  @ObjectProperty({
    description: '客户端支付参数',
    example: { orderNo: 'PAY20260506000001' },
    validation: false,
  })
  clientPayPayload!: Record<string, unknown>
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
    enum: MonetizationPlatformEnum,
    example: MonetizationPlatformEnum.ANDROID,
  })
  platform!: MonetizationPlatformEnum

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

export class ConfirmPaymentOrderDto {
  @StringProperty({
    description: '站内订单号',
    example: 'PAY20260506000001',
  })
  orderNo!: string

  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
    required: false,
  })
  providerTradeNo?: string

  @NumberProperty({
    description: '实付金额，单位为分',
    example: 1000,
    min: 0,
    required: false,
  })
  paidAmount?: number

  @ObjectProperty({
    description: '原始通知 payload',
    example: { status: 'success' },
    required: false,
  })
  notifyPayload?: Record<string, unknown>
}

export class QueryPaymentOrderDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(PaymentOrderResultDto, ['orderType', 'status'] as const),
  ),
) {}

export class WalletDetailDto {
  @NumberProperty({
    description: '虚拟币余额',
    example: 1000,
    validation: false,
  })
  currencyBalance!: number

  @DateProperty({
    description: 'VIP 到期时间',
    example: '2026-06-01T00:00:00.000Z',
    required: false,
    validation: false,
  })
  vipExpiresAt?: Date | null

  @NumberProperty({
    description: '可用券数量',
    example: 3,
    validation: false,
  })
  availableCouponCount!: number

  @NumberProperty({
    description: '已购作品数',
    example: 5,
    validation: false,
  })
  purchasedWorkCount!: number

  @NumberProperty({
    description: '已购章节数',
    example: 42,
    validation: false,
  })
  purchasedChapterCount!: number
}

export class AdRewardVerificationDto {
  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
  })
  provider!: AdProviderEnum

  @EnumProperty({
    description: '客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）',
    enum: MonetizationPlatformEnum,
    example: MonetizationPlatformEnum.ANDROID,
  })
  platform!: MonetizationPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    required: false,
    default: '',
  })
  clientAppKey?: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'pangle-app-id',
    required: false,
    default: '',
  })
  appId?: string

  @StringProperty({
    description: '广告位 key',
    example: 'reward-video-low-price',
  })
  placementKey!: string

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

  @StringProperty({
    description: 'provider 奖励唯一 ID',
    example: 'reward-uuid',
  })
  providerRewardId!: string

  @ObjectProperty({
    description: '客户端上下文',
    example: { deviceId: 'device' },
    required: false,
  })
  clientContext?: Record<string, unknown>

  @ObjectProperty({
    description: 'provider 验证 payload',
    example: { sign: 'signature' },
    required: false,
  })
  verifyPayload?: Record<string, unknown>
}

export class AdRewardResultDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
  })
  userId!: number

  @EnumProperty({
    description: '广告状态（1=奖励成功；2=奖励失败；3=已撤销）',
    enum: AdRewardStatusEnum,
    example: AdRewardStatusEnum.SUCCESS,
  })
  status!: AdRewardStatusEnum

  @StringProperty({
    description: 'provider 奖励唯一 ID',
    example: 'reward-uuid',
  })
  providerRewardId!: string
}
