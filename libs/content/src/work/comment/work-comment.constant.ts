/// 评论审核状态枚举
export enum WorkCommentAuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 审核通过 */
  APPROVED = 1,
  /** 审核拒绝 */
  REJECTED = 2,
}

/// 评论审核角色枚举
export enum WorkCommentAuditRoleEnum {
  /** 版主 */
  MODERATOR = 0,
  /** 管理员 */
  ADMIN = 1,
}

/// 评论举报状态枚举
export enum WorkCommentReportStatusEnum {
  /** 待处理 */
  PENDING = 'pending',
  /** 处理中 */
  PROCESSING = 'processing',
  /** 已解决 */
  RESOLVED = 'resolved',
  /** 已拒绝 */
  REJECTED = 'rejected',
}

/// 评论排序字段枚举
export enum WorkCommentSortFieldEnum {
  /** 创建时间 */
  CREATED_AT = 'createdAt',
  /** 楼层号 */
  FLOOR = 'floor',
}

/// 评论排序顺序枚举
export enum WorkCommentSortOrderEnum {
  /** 升序 */
  ASC = 'asc',
  /** 降序 */
  DESC = 'desc',
}
