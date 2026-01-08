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
 * 主题排序字段枚举
 */
export enum ForumTopicSortFieldEnum {
  /** 创建时间 */
  CREATED_AT = 'createdAt',
  /** 更新时间 */
  UPDATED_AT = 'updatedAt',
  /** 浏览次数 */
  VIEW_COUNT = 'viewCount',
  /** 回复数量 */
  REPLY_COUNT = 'replyCount',
  /** 点赞数量 */
  LIKE_COUNT = 'likeCount',
}

/**
 * 主题排序方向枚举
 */
export enum ForumTopicSortOrderEnum {
  /** 升序 */
  ASC = 'asc',
  /** 降序 */
  DESC = 'desc',
}
