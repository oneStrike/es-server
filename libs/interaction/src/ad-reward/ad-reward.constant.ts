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
