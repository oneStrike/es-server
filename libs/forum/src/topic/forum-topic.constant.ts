/**
 * 主题审核状态枚举
 */
export enum ForumTopicAuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 已通过 */
  APPROVED = 1,
  /** 已拒绝 */
  REJECTED = 2,
}

/**
 * 主题审核角色
 */
export enum ForumTopicAuditRoleEnum {
  /** 版主 */
  MODERATOR = 0,
  /** 管理员 */
  ADMIN = 1,
}
