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
