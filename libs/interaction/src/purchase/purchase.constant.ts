export enum PurchaseTargetTypeEnum {
  /** 漫画 */
  COMIC = 1,
  /** 小说 */
  NOVEL = 2,
  /** 漫画章节 */
  COMIC_CHAPTER = 3,
  /** 小说章节 */
  NOVEL_CHAPTER = 4,
}

export enum PurchaseStatusEnum {
  /** 成功 */
  SUCCESS = 1,
  /** 失败 */
  FAILED = 2,
  /** 退款中 */
  REFUNDING = 3,
  /** 已退款 */
  REFUNDED = 4,
}

export enum PaymentMethodEnum {
  /** 积分 */
  POINTS = 1,
  /** 余额 */
  BALANCE = 2,
  /** 支付宝 */
  ALIPAY = 3,
  /** 微信 */
  WECHAT = 4,
}
