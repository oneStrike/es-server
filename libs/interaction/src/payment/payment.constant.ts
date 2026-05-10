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

/**
 * 支付订单订阅模式。
 */
export enum PaymentSubscriptionModeEnum {
  /** 一次性支付。 */
  ONE_TIME = 1,
  /** 自动续费签约首单。 */
  AUTO_RENEW_SIGNING = 2,
  /** 自动续费代扣订单。 */
  AUTO_RENEW_WITHHOLD = 3,
}
