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
