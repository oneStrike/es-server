/**
 * 支付渠道。
 */
export enum PaymentChannelEnum {
  /** 支付宝。 */
  ALIPAY = 1,
  /** 微信支付。 */
  WECHAT = 2,
}

/**
 * 支付 provider 凭据类型。
 */
export enum PaymentProviderCredentialTypeEnum {
  /** 应用私钥凭据。 */
  APP_PRIVATE_KEY = 1,
  /** 支付宝平台公钥凭据。 */
  ALIPAY_PUBLIC_KEY = 2,
  /** 微信 APIv3 key 凭据。 */
  WECHAT_API_V3_KEY = 3,
  /** 微信商户私钥凭据。 */
  MERCHANT_PRIVATE_KEY = 4,
}

/**
 * Provider 通知路径渠道，仅允许第三方回调使用唯一的文本值。
 */
export enum PaymentProviderNotifyChannelEnum {
  /** 支付宝回调路径。 */
  ALIPAY = 'alipay',
  /** 微信支付回调路径。 */
  WECHAT = 'wechat',
}

/** 支付 provider 证书用途，和证书表的闭集值域保持一致。 */
export enum PaymentProviderCertificateTypeEnum {
  /** 应用证书。 */
  APP_CERTIFICATE = 1,
  /** 平台证书。 */
  PLATFORM_CERTIFICATE = 2,
  /** 根证书。 */
  ROOT_CERTIFICATE = 3,
  /** 公钥证书。 */
  PUBLIC_KEY_CERTIFICATE = 4,
}

/**
 * 支付场景。
 */
export enum PaymentSceneEnum {
  /** App 支付场景。 */
  APP = 1,
  /** H5 支付场景。 */
  H5 = 2,
  /** 小程序支付场景。 */
  MINI_PROGRAM = 3,
}

/**
 * 客户端平台。
 */
export enum ClientPlatformEnum {
  /** Android 客户端。 */
  ANDROID = 1,
  /** iOS 客户端。 */
  IOS = 2,
  /** HarmonyOS 客户端。 */
  HARMONYOS = 3,
  /** Web 客户端。 */
  WEB = 4,
  /** 小程序客户端。 */
  MINI_PROGRAM = 5,
}

/**
 * Provider 运行环境。
 */
export enum ProviderEnvironmentEnum {
  /** 沙箱环境。 */
  SANDBOX = 1,
  /** 正式环境。 */
  PRODUCTION = 2,
}

/**
 * 支付订单业务类型。
 */
export enum PaymentOrderTypeEnum {
  /** 虚拟币充值订单。 */
  CURRENCY_RECHARGE = 1,
  /** VIP 订阅订单。 */
  VIP_SUBSCRIPTION = 2,
}

/**
 * 支付订单状态。
 */
export enum PaymentOrderStatusEnum {
  /** 待支付。 */
  PENDING = 1,
  /** 已支付。 */
  PAID = 2,
  /** 已关闭。 */
  CLOSED = 3,
  /** 退款中。 */
  REFUNDING = 4,
  /** 已退款。 */
  REFUNDED = 5,
}

/** 支付 provider 通知事件类型，与 payment_notify_event 的闭集值域一致。 */
export enum PaymentNotifyEventTypeEnum {
  /** 支付成功事件。 */
  PAYMENT = 1,
  /** 支付失败事件。 */
  PAYMENT_FAILED = 2,
  /** 支付关闭事件。 */
  CLOSED = 3,
  /** 尚未解析为具体支付事实的 provider 原始通知。 */
  PROVIDER = 4,
}

/** 支付通知验签状态，与 payment_notify_event 的闭集值域一致。 */
export enum PaymentNotifyVerifyStatusEnum {
  /** 尚未完成验签。 */
  PENDING = 1,
  /** 验签成功。 */
  SUCCESS = 2,
  /** 验签失败。 */
  FAILED = 3,
}

/** 支付通知处理状态，与 payment_notify_event 的闭集值域一致。 */
export enum PaymentNotifyProcessStatusEnum {
  /** 已接收但尚未完成处理。 */
  PENDING = 1,
  /** 已完成首次处理。 */
  PROCESSED = 2,
  /** 已识别为重复通知。 */
  DUPLICATE = 3,
  /** 验签或结算处理失败。 */
  FAILED = 4,
}

/** 支付对账差异类型，与 payment_reconciliation_record 的闭集值域一致。 */
export enum PaymentReconciliationMismatchTypeEnum {
  /** 本地已支付但 provider 未支付。 */
  LOCAL_PAID_PROVIDER_UNPAID = 1,
  /** 本地待支付但 provider 已支付。 */
  LOCAL_PENDING_PROVIDER_PAID = 2,
  /** 本地与 provider 的金额不一致。 */
  AMOUNT_MISMATCH = 3,
  /** provider 交易号重复。 */
  DUPLICATE_PROVIDER_TRADE_NO = 4,
  /** provider 回调验签失败。 */
  NOTIFY_VERIFICATION_FAILED = 5,
  /** 退款状态或金额存在差异。 */
  REFUND_MISMATCH = 6,
}

/** 支付对账处理状态，与 payment_reconciliation_record 的闭集值域一致。 */
export enum PaymentReconciliationStatusEnum {
  /** 等待人工处理。 */
  PENDING = 1,
  /** 已确认差异。 */
  CONFIRMED = 2,
  /** 已完成修复。 */
  REPAIRED = 3,
  /** 已忽略该差异。 */
  IGNORED = 4,
}

/**
 * 支付订单订阅模式。
 */
export enum PaymentSubscriptionModeEnum {
  /** 一次性支付。 */
  ONE_TIME = 1,
}
