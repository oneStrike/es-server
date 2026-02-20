/**
 * 论坛回复审核状态枚举
 */
export enum ForumAuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 已通过 */
  APPROVED = 1,
  /** 已拒绝 */
  REJECTED = 2,
}

/**
 * 回复排序字段枚举
 */
export enum ForumReplySortFieldEnum {
  /** 楼层 */
  FLOOR = 'floor',
  /** 创建时间 */
  CREATED_AT = 'createdAt',
  /** 点赞数 */
  LIKE_COUNT = 'likeCount',
}

/**
 * 回复排序方式枚举
 */
export enum ForumReplySortOrderEnum {
  /** 升序 */
  ASC = 'asc',
  /** 降序 */
  DESC = 'desc',
}
