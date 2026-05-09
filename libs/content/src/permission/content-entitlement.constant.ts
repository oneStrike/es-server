/**
 * 内容权益目标类型。
 * 由内容域拥有，购买、券、广告等下游模块只能映射到这里，不能反向借用 interaction purchase 枚举。
 */
export enum ContentEntitlementTargetTypeEnum {
  /** 漫画章节 */
  COMIC_CHAPTER = 1,
  /** 小说章节 */
  NOVEL_CHAPTER = 2,
}

/**
 * 内容权益授权来源。
 * 区分购买、券、广告和后台补偿，避免临时授权污染购买统计。
 */
export enum ContentEntitlementGrantSourceEnum {
  /** 购买 */
  PURCHASE = 1,
  /** 阅读券 */
  COUPON = 2,
  /** 激励广告 */
  AD = 3,
  /** 后台补偿 */
  ADMIN = 4,
  /** VIP 试用 */
  VIP_TRIAL = 5,
}

/**
 * 内容权益状态。
 * 只有 ACTIVE 会参与阅读放行；购买计数还必须额外限制 grantSource=PURCHASE。
 */
export enum ContentEntitlementStatusEnum {
  /** 有效 */
  ACTIVE = 1,
  /** 已撤销 */
  REVOKED = 2,
  /** 已过期 */
  EXPIRED = 3,
}

/**
 * VIP 订阅来源类型。
 */
export enum MembershipSubscriptionSourceTypeEnum {
  /** 支付订单 */
  PAYMENT_ORDER = 1,
  /** VIP 试用卡 */
  VIP_TRIAL_COUPON = 2,
  /** 后台补偿 */
  ADMIN_GRANT = 3,
}

/**
 * VIP 订阅状态。
 */
export enum MembershipSubscriptionStatusEnum {
  /** 有效 */
  ACTIVE = 1,
  /** 已取消 */
  CANCELLED = 2,
  /** 已退款 */
  REFUNDED = 3,
  /** 已过期 */
  EXPIRED = 4,
}

/**
 * 内容购买权益目标集合。
 * 购买计数、已购列表和 purchased 字段只允许统计这些目标的购买来源权益。
 */
export const CONTENT_PURCHASE_ENTITLEMENT_TARGET_TYPES = [
  ContentEntitlementTargetTypeEnum.COMIC_CHAPTER,
  ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER,
] as const
