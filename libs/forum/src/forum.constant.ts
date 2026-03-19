/**
 * 论坛通用常量定义
 */

/**
 * 论坛主题审核策略枚举
 */
export enum ForumReviewPolicyEnum {
  /** 不审核 */
  NONE = 0,
  /** 严重敏感词触发审核 */
  SEVERE_SENSITIVE_WORD = 1,
  /** 一般敏感词触发审核 */
  GENERAL_SENSITIVE_WORD = 2,
  /** 轻度敏感词触发审核 */
  MILD_SENSITIVE_WORD = 3,
  /** 强制人工审核 */
  MANUAL = 4,
}
