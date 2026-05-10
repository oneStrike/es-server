import {
  ArrayProperty,
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
  ClientPlatformEnum,
  PaymentChannelEnum,
  PaymentOrderStatusEnum,
  PaymentOrderTypeEnum,
  PaymentSceneEnum,
  PaymentSubscriptionModeEnum,
  ProviderEnvironmentEnum,
} from '../payment.constant'

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
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
  })
  platform!: ClientPlatformEnum

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
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
  })
  platform!: ClientPlatformEnum

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

export class PaymentOrderResultDto {
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

export class AdminPaymentOrderPageItemDto extends BaseDto {
  @StringProperty({
    description: '站内订单号',
    example: 'PAY20260506000001',
  })
  orderNo!: string

  @NumberProperty({
    description: '用户 ID',
    example: 10001,
  })
  userId!: number

  @EnumProperty({
    description: '订单业务类型（1=虚拟币充值；2=VIP 订阅）',
    enum: PaymentOrderTypeEnum,
    example: PaymentOrderTypeEnum.CURRENCY_RECHARGE,
  })
  orderType!: PaymentOrderTypeEnum

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
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
  })
  clientAppKey!: string

  @EnumProperty({
    description: '订阅模式（1=一次性；2=自动续费签约首单；3=自动续费代扣订单）',
    enum: PaymentSubscriptionModeEnum,
    example: PaymentSubscriptionModeEnum.ONE_TIME,
  })
  subscriptionMode!: PaymentSubscriptionModeEnum

  @NumberProperty({
    description: '自动续费协议 ID，非自动续费订单为空',
    example: 1,
    required: false,
  })
  autoRenewAgreementId?: number | null

  @EnumProperty({
    description: '订单状态（1=待支付；2=已支付；3=已关闭；4=退款中；5=已退款）',
    enum: PaymentOrderStatusEnum,
    example: PaymentOrderStatusEnum.PENDING,
  })
  status!: PaymentOrderStatusEnum

  @NumberProperty({
    description: '应付金额，单位为分',
    example: 1000,
  })
  payableAmount!: number

  @NumberProperty({
    description: '实付金额，单位为分',
    example: 1000,
  })
  paidAmount!: number

  @NumberProperty({
    description: '业务目标 ID，例如充值包 ID 或 VIP 套餐 ID',
    example: 1,
  })
  targetId!: number

  @NumberProperty({
    description: '支付 provider 配置 ID',
    example: 1,
  })
  providerConfigId!: number

  @NumberProperty({
    description: '下单时 provider 配置版本快照',
    example: 1,
  })
  providerConfigVersion!: number

  @StringProperty({
    description: '下单时密钥版本引用快照',
    example: 'kms://payment/default/v1',
  })
  credentialVersionRef!: string

  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
    required: false,
  })
  providerTradeNo?: string | null

  @DateProperty({
    description: '支付完成时间',
    required: false,
  })
  paidAt?: Date | null

  @DateProperty({
    description: '关闭时间',
    required: false,
  })
  closedAt?: Date | null

  @DateProperty({
    description: '退款完成时间',
    required: false,
  })
  refundedAt?: Date | null
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
  providerTradeNo?: string | null

  @NumberProperty({
    description: '实付金额，单位为分',
    example: 1000,
    min: 0,
    required: false,
  })
  paidAmount?: number | null

  @ObjectProperty({
    description: '原始通知 payload',
    example: { status: 'success' },
    required: false,
  })
  notifyPayload?: Record<string, unknown> | null
}

export class QueryPaymentOrderDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(PaymentOrderResultDto, ['orderType', 'status'] as const),
  ),
) {}
