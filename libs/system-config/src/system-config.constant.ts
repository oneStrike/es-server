/**
 * 系统配置相关常量与枚举
 */

/**
 * 内容审核状态枚举
 */
export enum ContentReviewAuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 审核通过 */
  APPROVED = 1,
  /** 审核拒绝 */
  REJECTED = 2,
}
