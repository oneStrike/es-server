export enum PurchaseTargetTypeEnum {
  /** 漫画章节 */
  COMIC_CHAPTER = 1,
  /** 小说章节 */
  NOVEL_CHAPTER = 2,
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
}
