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
    description:
      '客户端平台（1=安卓端；2=苹果端；3=鸿蒙端；4=网页端；5=小程序）',
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
    default: '',
  })
  clientAppKey!: string

  @StringProperty({
    description: '配置名称，供后台识别',
    example: '微信 App 正式配置',
    default: '',
  })
  configName!: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'wx-app-id',
    default: '',
  })
  appId!: string

  @StringProperty({
    description: 'provider 商户 ID',
    example: 'mch-id',
    default: '',
  })
  mchId!: string

  @StringProperty({
    description: '通知回调地址',
    example: 'https://example.com/payment/notify',
    nullable: true,
    type: 'url',
  })
  notifyUrl!: string | null

  @StringProperty({
    description: 'H5 返回地址',
    example: 'https://example.com/pay/return',
    nullable: true,
    type: 'url',
  })
  returnUrl!: string | null

  @ArrayProperty({
    description: 'H5 允许返回域名列表',
    itemType: 'string',
    nullable: true,
  })
  allowedReturnDomains!: string[] | null

  @NumberProperty({
    description: '证书模式（1=普通密钥；2=证书模式）',
    example: 1,
    min: 1,
    default: 1,
  })
  certMode!: number

  @StringProperty({
    description: '支付宝公钥引用',
    example: 'kms://payment/alipay/public-key/v1',
    nullable: true,
    maxLength: 160,
  })
  publicKeyRef!: string | null

  @StringProperty({
    description: '应用私钥引用',
    example: 'kms://payment/alipay/private-key/v1',
    nullable: true,
    maxLength: 160,
  })
  privateKeyRef!: string | null

  @StringProperty({
    description: '微信 APIv3 key 引用',
    example: 'kms://payment/wechat/api-v3-key/v1',
    nullable: true,
    maxLength: 160,
  })
  apiV3KeyRef!: string | null

  @StringProperty({
    description: '应用证书引用',
    example: 'kms://payment/app-cert/v1',
    nullable: true,
    maxLength: 160,
  })
  appCertRef!: string | null

  @StringProperty({
    description: '平台证书引用',
    example: 'kms://payment/platform-cert/v1',
    nullable: true,
    maxLength: 160,
  })
  platformCertRef!: string | null

  @StringProperty({
    description: '根证书引用',
    example: 'kms://payment/root-cert/v1',
    nullable: true,
    maxLength: 160,
  })
  rootCertRef!: string | null

  @NumberProperty({
    description: '配置版本',
    example: 1,
    min: 1,
    default: 1,
  })
  configVersion!: number

  @StringProperty({
    description: '密钥版本引用',
    example: 'kms://payment/alipay/default/v1',
    maxLength: 160,
  })
  credentialVersionRef!: string

  @ObjectProperty({
    description: '配置摘要，不包含明文密钥',
    example: { keyFingerprint: 'sha256:xxx' },
    nullable: true,
    validation: false,
  })
  configMetadata!: Record<string, unknown> | null

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

export class PaymentProviderConfigCredentialSelectorFieldsDto {
  @NumberProperty({
    description: '主凭据选项 ID，后台写入时解析为内部密钥版本引用',
    example: 1,
    min: 1,
    required: false,
  })
  credentialOptionId!: number | null

  @NumberProperty({
    description: '应用私钥凭据选项 ID，后台写入时解析为内部引用',
    example: 1,
    min: 1,
    required: false,
  })
  privateKeyCredentialId!: number | null

  @NumberProperty({
    description: '支付宝公钥凭据选项 ID，后台写入时解析为内部引用',
    example: 2,
    min: 1,
    required: false,
  })
  publicKeyCredentialId!: number | null

  @NumberProperty({
    description: '微信 APIv3 key 凭据选项 ID，后台写入时解析为内部引用',
    example: 3,
    min: 1,
    required: false,
  })
  apiV3KeyCredentialId!: number | null

  @NumberProperty({
    description: '应用证书选项 ID，后台写入时解析为内部引用',
    example: 1,
    min: 1,
    required: false,
  })
  appCertificateId!: number | null

  @NumberProperty({
    description: '平台证书选项 ID，后台写入时解析为内部引用',
    example: 2,
    min: 1,
    required: false,
  })
  platformCertificateId!: number | null

  @NumberProperty({
    description: '根证书选项 ID，后台写入时解析为内部引用',
    example: 3,
    min: 1,
    required: false,
  })
  rootCertificateId!: number | null
}

export class PaymentProviderConfigRequiredWritableFieldsDto extends PickType(
  BasePaymentProviderConfigDto,
  ['channel', 'paymentScene', 'platform', 'environment'] as const,
) {}

export class PaymentProviderConfigOptionalWritableFieldsDto extends PartialType(
  PickType(BasePaymentProviderConfigDto, [
    'clientAppKey',
    'configName',
    'appId',
    'mchId',
    'notifyUrl',
    'returnUrl',
    'allowedReturnDomains',
    'certMode',
    'sortOrder',
    'isEnabled',
  ] as const),
) {}

export class CreatePaymentProviderConfigDto extends IntersectionType(
  PaymentProviderConfigRequiredWritableFieldsDto,
  IntersectionType(
    PaymentProviderConfigOptionalWritableFieldsDto,
    PaymentProviderConfigCredentialSelectorFieldsDto,
  ),
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

/**
 * 支付 provider 账号选项查询条件。
 *
 * 该接口始终返回受限数量的完整选项列表，不能继承分页、排序或日期查询字段。
 */
export class PaymentProviderAccountOptionQueryDto extends PartialType(
  PickType(BasePaymentProviderConfigDto, [
    'channel',
    'paymentScene',
    'platform',
    'environment',
    'clientAppKey',
    'isEnabled',
  ] as const),
) {}

export class AdminPaymentProviderConfigPageItemDto extends PickType(
  BasePaymentProviderConfigDto,
  [
    'id',
    'createdAt',
    'updatedAt',
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
    'allowedReturnDomains',
    'certMode',
    'configMetadata',
    'sortOrder',
    'isEnabled',
  ] as const,
) {}

export class PaymentProviderAccountOptionDto {
  @StringProperty({
    description: '选项展示名',
    example: '微信 App 正式配置 / mch-id',
    validation: false,
  })
  label!: string

  @NumberProperty({
    description: '选项值，支付 provider 配置 ID',
    example: 1,
    validation: false,
  })
  value!: number

  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
    validation: false,
  })
  channel!: PaymentChannelEnum

  @EnumProperty({
    description: '支付场景（1=App；2=H5；3=小程序）',
    enum: PaymentSceneEnum,
    example: PaymentSceneEnum.APP,
    validation: false,
  })
  paymentScene!: PaymentSceneEnum

  @EnumProperty({
    description:
      '客户端平台（1=安卓端；2=苹果端；3=鸿蒙端；4=网页端；5=小程序）',
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
    validation: false,
  })
  platform!: ClientPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.PRODUCTION,
    validation: false,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    validation: false,
  })
  clientAppKey!: string

  @StringProperty({
    description: 'provider 应用 ID 后四位掩码',
    example: '****1234',
    validation: false,
  })
  maskedAppId!: string

  @StringProperty({
    description: 'provider 商户 ID 后四位掩码',
    example: '****5678',
    validation: false,
  })
  maskedMchId!: string

  @NumberProperty({
    description: '当前配置版本',
    example: 3,
    validation: false,
  })
  configVersion!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    validation: false,
  })
  isEnabled!: boolean
}

export class PaymentProviderCredentialOptionQueryDto {
  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
    required: false,
  })
  channel?: PaymentChannelEnum

  @NumberProperty({
    description:
      '凭据用途（1=应用私钥；2=支付宝公钥；3=微信 APIv3 key；4=商户私钥）',
    example: 1,
    min: 1,
    required: false,
  })
  credentialType?: number

  @NumberProperty({
    description: '凭据状态（1=启用；2=禁用；3=过期）',
    example: 1,
    min: 1,
    required: false,
  })
  status?: number
}

export class PaymentProviderCredentialOptionDto {
  @StringProperty({
    description: '选项展示名',
    example: '支付宝正式应用私钥 v3',
    validation: false,
  })
  label!: string

  @NumberProperty({
    description: '选项值，凭据记录 ID',
    example: 1,
    validation: false,
  })
  value!: number

  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
    validation: false,
  })
  channel!: PaymentChannelEnum

  @NumberProperty({
    description:
      '凭据用途（1=应用私钥；2=支付宝公钥；3=微信 APIv3 key；4=商户私钥）',
    example: 1,
    validation: false,
  })
  credentialType!: number

  @StringProperty({
    description: '凭据版本标签',
    example: 'v3',
    validation: false,
  })
  versionLabel!: string

  @StringProperty({
    description: '掩码标识',
    example: '****1234',
    validation: false,
  })
  maskedIdentifier!: string

  @StringProperty({
    description: '凭据指纹',
    example: 'sha256:abcdef12',
    validation: false,
  })
  fingerprint!: string

  @NumberProperty({
    description: '凭据状态（1=启用；2=禁用；3=过期）',
    example: 1,
    validation: false,
  })
  status!: number

  @DateProperty({
    description: '过期时间',
    nullable: true,
    validation: false,
  })
  expiredAt!: Date | null
}

export class PaymentProviderCertificateOptionQueryDto {
  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
    required: false,
  })
  channel?: PaymentChannelEnum

  @NumberProperty({
    description: '证书用途（1=应用证书；2=平台证书；3=根证书；4=公钥证书）',
    example: 1,
    min: 1,
    required: false,
  })
  certificateType?: number

  @NumberProperty({
    description: '证书状态（1=启用；2=禁用；3=过期）',
    example: 1,
    min: 1,
    required: false,
  })
  status?: number
}

export class PaymentProviderCertificateOptionDto {
  @StringProperty({
    description: '选项展示名',
    example: '微信平台证书 v2',
    validation: false,
  })
  label!: string

  @NumberProperty({
    description: '选项值，证书记录 ID',
    example: 1,
    validation: false,
  })
  value!: number

  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.WECHAT,
    validation: false,
  })
  channel!: PaymentChannelEnum

  @NumberProperty({
    description: '证书用途（1=应用证书；2=平台证书；3=根证书；4=公钥证书）',
    example: 2,
    validation: false,
  })
  certificateType!: number

  @StringProperty({
    description: '证书版本标签',
    example: 'v2',
    validation: false,
  })
  versionLabel!: string

  @StringProperty({
    description: 'provider 证书序列号掩码',
    example: '****ABCD',
    validation: false,
  })
  maskedSerialNo!: string

  @StringProperty({
    description: '证书指纹',
    example: 'sha256:abcdef12',
    validation: false,
  })
  fingerprint!: string

  @NumberProperty({
    description: '证书状态（1=启用；2=禁用；3=过期）',
    example: 1,
    validation: false,
  })
  status!: number

  @DateProperty({
    description: '过期时间',
    nullable: true,
    validation: false,
  })
  expiredAt!: Date | null
}

export class CreatePaymentOrderBaseDto extends IntersectionType(
  PickType(BasePaymentProviderConfigDto, [
    'channel',
    'paymentScene',
    'platform',
    'environment',
  ] as const),
  PartialType(
    PickType(BasePaymentProviderConfigDto, [
      'clientAppKey',
      'appId',
      'mchId',
      'returnUrl',
    ] as const),
  ),
) {
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

/**
 * 支付订单基础 DTO（全量字段）
 */
export class BasePaymentOrderDto extends BaseDto {
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
    description: '订单状态（1=待支付；2=已支付；3=已关闭；4=退款中；5=已退款）',
    enum: PaymentOrderStatusEnum,
    example: PaymentOrderStatusEnum.PENDING,
  })
  status!: PaymentOrderStatusEnum

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
    description:
      '客户端平台（1=安卓端；2=苹果端；3=鸿蒙端；4=网页端；5=小程序）',
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
    description: '订阅模式（1=一次性）',
    enum: PaymentSubscriptionModeEnum,
    example: PaymentSubscriptionModeEnum.ONE_TIME,
    validation: false,
  })
  subscriptionMode!: PaymentSubscriptionModeEnum

  @NumberProperty({
    description: '应付金额，单位为分',
    example: 1000,
  })
  payableAmount!: number

  @NumberProperty({
    description: '实付金额，单位为分',
    example: 1000,
    nullable: true,
    validation: false,
  })
  paidAmount!: number | null

  @StringProperty({
    description: '币种',
    example: 'CNY',
    validation: false,
  })
  currency!: string

  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
    nullable: true,
    validation: false,
  })
  providerTradeNo!: string | null

  @DateProperty({
    description: '过期时间',
    nullable: true,
    validation: false,
  })
  expireAt!: Date | null

  @DateProperty({
    description: '支付完成时间',
    nullable: true,
    validation: false,
  })
  paidAt!: Date | null

  @DateProperty({
    description: '关闭时间',
    nullable: true,
    validation: false,
  })
  closedAt!: Date | null

  @ObjectProperty({
    description: '客户端支付参数',
    example: { orderNo: 'PAY20260506000001' },
    nullable: true,
    validation: false,
  })
  clientPayPayload!: Record<string, unknown> | null
}

export class PaymentOrderResultDto extends PickType(BasePaymentOrderDto, [
  'orderNo',
  'subscriptionMode',
  'payableAmount',
  'clientPayPayload',
  'orderType',
  'status',
] as const) {}

export class GetPaymentOrderStatusDto extends PickType(BasePaymentOrderDto, [
  'orderNo',
] as const) {}

export class PaymentOrderStatusDto extends PickType(BasePaymentOrderDto, [
  'orderNo',
  'status',
  'orderType',
  'channel',
  'payableAmount',
  'paidAmount',
  'currency',
  'expireAt',
  'paidAt',
  'closedAt',
] as const) {
  @EnumProperty({
    description: '支付场景（1=App；2=H5；3=小程序）',
    enum: PaymentSceneEnum,
    example: PaymentSceneEnum.APP,
    validation: false,
  })
  scene!: PaymentSceneEnum

  @ObjectProperty({
    description: '客户端支付参数，不包含密钥、证书或内部配置引用',
    example: { channel: 'alipay', scene: 'app', orderString: 'provider-data' },
    nullable: true,
    validation: false,
  })
  clientPayPayload!: Record<string, unknown> | null
}

export class ProviderPaymentNotifyParamsDto {
  @StringProperty({
    description: '支付渠道路径值，支持支付宝或微信的数字值与文本值',
    example: 'wechat',
  })
  channel!: string
}

/**
 * Provider 回调头是签名协议边界的开放 map，普通业务字段不得藏在这里。
 */
export class ProviderPaymentNotifyHeadersDto {
  @ObjectProperty({
    description: 'Provider 原始请求头开放 map，仅用于第三方签名协议验签',
    example: {
      wechatpayTimestamp: '1780826500',
      wechatpayNonce: 'nonce',
      wechatpaySignature: 'base64-signature',
    },
    additionalProperties: true,
  })
  raw!: Record<string, unknown>
}

/**
 * Provider 回调 query 是签名协议边界的开放 map，普通业务字段不得藏在这里。
 */
export class ProviderPaymentNotifyQueryDto {
  @ObjectProperty({
    description:
      'Provider 原始 query 开放 map，仅用于第三方签名协议和通知字段解析',
    example: { charset: 'utf-8', sign_type: 'RSA2' },
    additionalProperties: true,
  })
  raw!: Record<string, unknown>
}

/**
 * Provider 回调 body 是第三方协议开放 map，由支付适配器完成验签与字段解析。
 */
export class ProviderPaymentNotifyBodyDto {
  @ObjectProperty({
    description: 'Provider 原始 body 开放 map，由支付适配器完成验签与字段解析',
    example: {
      out_trade_no: 'PAY20260506000001',
      trade_no: 'provider-trade-no',
      total_amount: '10.00',
    },
    additionalProperties: true,
  })
  raw!: Record<string, unknown>
}

export class ProviderPaymentNotifyAckDto {
  @StringProperty({
    description: 'Provider 回调确认码',
    example: 'SUCCESS',
    validation: false,
  })
  code!: string

  @StringProperty({
    description: 'Provider 回调确认消息',
    example: '成功',
    validation: false,
  })
  message!: string
}

export class AdminPaymentOrderPageItemDto extends PickType(
  BasePaymentOrderDto,
  [
    'id',
    'createdAt',
    'updatedAt',
    'orderNo',
    'userId',
    'orderType',
    'channel',
    'paymentScene',
    'platform',
    'environment',
    'clientAppKey',
    'subscriptionMode',
    'status',
    'payableAmount',
    'providerTradeNo',
    'paidAt',
    'closedAt',
  ] as const,
) {
  @NumberProperty({
    description: '实付金额，单位为分',
    example: 1000,
    validation: false,
  })
  paidAmount!: number

  @NumberProperty({
    description: '业务目标 ID，例如充值包 ID 或 VIP 套餐 ID',
    example: 1,
    validation: false,
  })
  targetId!: number

  @NumberProperty({
    description: '支付 provider 账号选项值',
    example: 1,
    validation: false,
  })
  providerConfigId!: number

  @StringProperty({
    description: '支付 provider 账号展示名',
    example: '微信 App 正式配置 / ****5678',
    validation: false,
  })
  providerAccountLabel!: string

  @StringProperty({
    description: '下单时 provider 配置版本展示',
    example: '配置版本 v3',
    validation: false,
  })
  providerConfigVersionLabel!: string

  @DateProperty({
    description: '退款完成时间',
    nullable: true,
    validation: false,
  })
  refundedAt!: Date | null
}

export class ConfirmPaymentOrderDto extends IntersectionType(
  PickType(BasePaymentOrderDto, ['orderNo'] as const),
  PartialType(
    PickType(BasePaymentOrderDto, ['providerTradeNo', 'paidAmount'] as const),
  ),
) {
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
    PickType(BasePaymentOrderDto, [
      'orderNo',
      'userId',
      'orderType',
      'status',
      'channel',
      'paymentScene',
      'platform',
      'environment',
      'clientAppKey',
    ] as const),
  ),
) {
  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
    required: false,
  })
  providerTradeNo?: string

  @NumberProperty({
    description: '支付 provider 账号选项值',
    example: 1,
    min: 1,
    required: false,
  })
  providerConfigId?: number
}

export class QueryPaymentReconciliationDto extends PageDto {
  @StringProperty({
    description: '站内订单号',
    example: 'PAY20260506000001',
    required: false,
  })
  orderNo?: string

  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
    required: false,
  })
  channel?: PaymentChannelEnum

  @NumberProperty({
    description:
      '差异类型（1=本地已支付 provider 未支付；2=本地待支付 provider 已支付；3=金额不一致；4=重复交易号；5=验签失败；6=退款差异）',
    example: 2,
    min: 1,
    required: false,
  })
  mismatchType?: number

  @NumberProperty({
    description: '对账状态（1=待处理；2=已确认；3=已修复；4=忽略）',
    example: 1,
    min: 1,
    required: false,
  })
  status?: number

  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
    required: false,
  })
  providerTradeNo?: string
}

export class AdminPaymentReconciliationPageItemDto extends BaseDto {
  @NumberProperty({
    description: '支付订单 ID',
    example: 1,
    nullable: true,
    validation: false,
  })
  paymentOrderId!: number | null

  @StringProperty({
    description: '站内订单号',
    example: 'PAY20260506000001',
    validation: false,
  })
  orderNo!: string

  @EnumProperty({
    description: '支付渠道（1=支付宝；2=微信）',
    enum: PaymentChannelEnum,
    example: PaymentChannelEnum.ALIPAY,
    validation: false,
  })
  channel!: PaymentChannelEnum

  @NumberProperty({
    description:
      '差异类型（1=本地已支付 provider 未支付；2=本地待支付 provider 已支付；3=金额不一致；4=重复交易号；5=验签失败；6=退款差异）',
    example: 2,
    validation: false,
  })
  mismatchType!: number

  @NumberProperty({
    description: '对账状态（1=待处理；2=已确认；3=已修复；4=忽略）',
    example: 1,
    validation: false,
  })
  status!: number

  @EnumProperty({
    description:
      '本地订单状态（1=待支付；2=已支付；3=已关闭；4=退款中；5=已退款）',
    enum: PaymentOrderStatusEnum,
    example: PaymentOrderStatusEnum.PENDING,
    validation: false,
  })
  localStatus!: PaymentOrderStatusEnum

  @StringProperty({
    description: 'provider 订单状态',
    example: 'SUCCESS',
    validation: false,
  })
  providerStatus!: string

  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
    nullable: true,
    validation: false,
  })
  providerTradeNo!: string | null

  @NumberProperty({
    description: '本地金额，单位为分',
    example: 1000,
    validation: false,
  })
  localAmount!: number

  @NumberProperty({
    description: 'provider 金额，单位为分',
    example: 1000,
    nullable: true,
    validation: false,
  })
  providerAmount!: number | null

  @StringProperty({
    description: '币种',
    example: 'CNY',
    validation: false,
  })
  currency!: string

  @ObjectProperty({
    description: '对账证据摘要，敏感字段已脱敏',
    example: { providerStatus: 'SUCCESS' },
    nullable: true,
    validation: false,
  })
  evidence!: Record<string, unknown> | null

  @StringProperty({
    description: '处理备注',
    example: '已按 provider 已支付事实修复',
    nullable: true,
    validation: false,
  })
  handledRemark!: string | null

  @BooleanProperty({
    description: '是否允许通过异常修复置为已支付',
    example: true,
    validation: false,
  })
  repairPaidAvailable!: boolean

  @BooleanProperty({
    description: '退款执行是否开放；本轮固定为 false',
    example: false,
    validation: false,
  })
  refundExecutionAvailable!: boolean
}

export class RepairPaidPaymentOrderDto extends PickType(BasePaymentOrderDto, [
  'orderNo',
] as const) {
  @StringProperty({
    description: '第三方交易号',
    example: 'provider-trade-no',
  })
  providerTradeNo!: string

  @NumberProperty({
    description: '实付金额，单位为分',
    example: 1000,
    min: 0,
  })
  paidAmount!: number

  @StringProperty({
    description: '异常修复原因',
    example: 'provider 对账确认已支付，本地未收到通知',
    minLength: 2,
    maxLength: 300,
  })
  reason!: string

  @ObjectProperty({
    description: '异常修复证据摘要，禁止明文密钥、证书或完整原始回调',
    example: { reconciliationRecordId: 1, providerStatus: 'SUCCESS' },
  })
  evidence!: Record<string, unknown>

  @NumberProperty({
    description: '关联对账记录 ID',
    example: 1,
    min: 1,
  })
  reconciliationRecordId!: number
}
