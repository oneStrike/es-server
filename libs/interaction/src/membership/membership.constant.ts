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
}

/**
 * 会员权益发放策略。
 */
export enum MembershipBenefitGrantPolicyEnum {
  /** 仅展示，不发放事实。 */
  DISPLAY_ONLY = 1,
  /** 订阅开通时自动发放。 */
  AUTO_GRANT_ON_SUBSCRIBE = 2,
}
