/**
 * 审核相关常量定义
 * 统一审核状态与审核角色枚举
 */

/**
 * 审核状态枚举
 * 用于评论、主题、回复等内容的审核流程状态
 */
export enum AuditStatusEnum {
  /** 待审核 - 内容已提交，等待审核 */
  PENDING = 0,
  /** 已通过 - 审核通过，内容可见 */
  APPROVED = 1,
  /** 已拒绝 - 审核拒绝，内容不可见 */
  REJECTED = 2,
}

/**
 * 审核角色枚举
 * 用于标识执行审核操作的角色类型
 */
export enum AuditRoleEnum {
  /** 版主 - 论坛版块管理员 */
  MODERATOR = 0,
  /** 管理员 - 系统管理员 */
  ADMIN = 1,
}
