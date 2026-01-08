/**
 * 审核状态
 */
export enum AuditStatusEnum {
  /** 待审核 */
  Pending = 0,
  /** 已通过 */
  Approved = 1,
  /** 已拒绝 */
  Rejected = 2,
}

/**
 * 审核人的角色
 */
export enum AuditRoleEnum {
  /** 版主 */
  Moderator = 0,
  /** 管理员 */
  Admin = 1,
}

/**
 * 审核对象类型
 */
export enum ObjectTypeEnum {
  /** 主题 */
  Topic = 1,
  /** 回复 */
  Reply = 2,
}
