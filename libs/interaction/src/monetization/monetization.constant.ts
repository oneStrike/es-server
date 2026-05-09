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
export enum MonetizationPlatformEnum {
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
 * VIP 套餐层级。
 */
export enum MembershipPlanTierEnum {
  /** 普通 VIP 套餐。 */
  VIP = 1,
  /** 超级 VIP 高阶权益包。 */
  SUPER_VIP = 2,
}

/**
 * 会员权益类型。
 */
export enum MembershipBenefitTypeEnum {
  /** 纯展示权益。 */
  DISPLAY = 1,
  /** 券发放权益。 */
  COUPON_GRANT = 2,
  /** 道具或装扮发放权益。 */
  ITEM_GRANT = 3,
  /** 订阅期持续权益。 */
  SUBSCRIPTION_ENTITLEMENT = 4,
  /** 无广告策略权益。 */
  NO_AD_POLICY = 5,
  /** 内容优先看策略权益。 */
  EARLY_ACCESS_POLICY = 6,
}

/**
 * 会员权益发放策略。
 */
export enum MembershipBenefitGrantPolicyEnum {
  /** 仅展示，不发放事实。 */
  DISPLAY_ONLY = 1,
  /** 订阅开通时自动发放。 */
  AUTO_GRANT_ON_SUBSCRIBE = 2,
  /** 每日可领取一次。 */
  DAILY_CLAIMABLE = 3,
  /** 订阅期内持续生效。 */
  ACTIVE_DURING_SUBSCRIPTION = 4,
  /** 手动领取一次。 */
  MANUAL_ONE_TIME_CLAIM = 5,
}

/**
 * 会员权益领取状态。
 */
export enum MembershipBenefitClaimStatusEnum {
  /** 领取成功。 */
  SUCCESS = 1,
  /** 领取失败。 */
  FAILED = 2,
  /** 已撤销。 */
  REVOKED = 3,
}

/**
 * 会员自动续费协议状态。
 */
export enum MembershipAutoRenewAgreementStatusEnum {
  /** 协议有效。 */
  ACTIVE = 1,
  /** 已取消。 */
  CANCELLED = 2,
  /** 已过期。 */
  EXPIRED = 3,
  /** 签约失败。 */
  FAILED = 4,
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

/**
 * 用户可消费虚拟币资产键。
 */
export const READING_COIN_ASSET_KEY = 'reading_coin'

/**
 * 广告 provider。
 */
export enum AdProviderEnum {
  /** 穿山甲广告。 */
  PANGLE = 1,
  /** 腾讯优量汇广告。 */
  TENCENT_YOU_LIANG_HUI = 2,
}

/**
 * 广告目标范围。
 */
export enum AdTargetScopeEnum {
  /** 低价章节解锁。 */
  LOW_PRICE_CHAPTER = 1,
  /** 新用户冷启动权益。 */
  NEW_USER_COLD_START = 2,
  /** 运营白名单权益。 */
  OPERATION_ALLOWLIST = 3,
}

/**
 * 广告奖励状态。
 */
export enum AdRewardStatusEnum {
  /** 奖励发放成功。 */
  SUCCESS = 1,
  /** 奖励发放失败。 */
  FAILED = 2,
  /** 奖励已撤销。 */
  REVOKED = 3,
}

/**
 * 券类型。
 */
export enum CouponTypeEnum {
  /** 章节阅读券。 */
  READING = 1,
  /** 折扣券。 */
  DISCOUNT = 2,
  /** VIP 试用卡。 */
  VIP_TRIAL = 3,
  /** 免广告卡。 */
  NO_AD = 4,
  /** 补签卡。 */
  CHECK_IN_MAKEUP = 5,
}

/**
 * 券适用范围。
 */
export enum CouponTargetScopeEnum {
  /** 章节目标。 */
  CHAPTER = 1,
  /** VIP 目标。 */
  VIP = 2,
  /** 广告目标。 */
  AD = 3,
  /** 签到目标。 */
  CHECK_IN = 4,
}

/**
 * 用户券实例状态。
 */
export enum CouponInstanceStatusEnum {
  /** 可用。 */
  AVAILABLE = 1,
  /** 已用完。 */
  USED_UP = 2,
  /** 已过期。 */
  EXPIRED = 3,
  /** 已撤销。 */
  REVOKED = 4,
}

/**
 * 券来源。
 */
export enum CouponSourceTypeEnum {
  /** 任务发放。 */
  TASK = 1,
  /** 积分兑换。 */
  POINTS_EXCHANGE = 2,
  /** 后台发放。 */
  ADMIN_GRANT = 3,
  /** 购买补偿。 */
  PURCHASE_COMPENSATION = 4,
}

/**
 * 券核销目标类型。
 */
export enum CouponRedemptionTargetTypeEnum {
  /** 漫画章节。 */
  COMIC_CHAPTER = 1,
  /** 小说章节。 */
  NOVEL_CHAPTER = 2,
  /** VIP 权益。 */
  VIP = 3,
  /** 签到权益。 */
  CHECK_IN = 4,
}

/**
 * 券核销状态。
 */
export enum CouponRedemptionStatusEnum {
  /** 核销成功。 */
  SUCCESS = 1,
  /** 核销失败。 */
  FAILED = 2,
  /** 核销已撤销。 */
  REVOKED = 3,
}
