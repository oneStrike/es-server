/**
 * 漫画章节评论审核状态枚举
 */
export enum ComicChapterCommentAuditStatusEnum {
  /** 待审核 */
  PENDING = 0,
  /** 已通过 */
  APPROVED = 1,
  /** 已拒绝 */
  REJECTED = 2,
}

/**
 * 漫画章节评论审核角色枚举
 */
export enum ComicChapterCommentAuditRoleEnum {
  /** 版主 */
  MODERATOR = 0,
  /** 管理员 */
  ADMIN = 1,
}

/**
 * 漫画章节评论排序字段枚举
 */
export enum ComicChapterCommentSortFieldEnum {
  /** 楼层号 */
  FLOOR = 'floor',
  /** 创建时间 */
  CREATED_AT = 'createdAt',
}

/**
 * 漫画章节评论排序方式枚举
 */
export enum ComicChapterCommentSortOrderEnum {
  /** 升序 */
  ASC = 'asc',
  /** 降序 */
  DESC = 'desc',
}

/**
 * 漫画章节评论举报状态枚举
 */
export enum ComicChapterCommentReportStatusEnum {
  /** 待处理 */
  PENDING = 'pending',
  /** 处理中 */
  PROCESSING = 'processing',
  /** 已解决 */
  RESOLVED = 'resolved',
  /** 已驳回 */
  REJECTED = 'rejected',
}

/**
 * 漫画章节评论举报原因枚举
 */
export enum ComicChapterCommentReportReasonEnum {
  /** 垃圾信息 */
  SPAM = 'spam',
  /** 不当内容 */
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  /** 骚扰行为 */
  HARASSMENT = 'harassment',
  /** 版权侵权 */
  COPYRIGHT = 'copyright',
  /** 其他原因 */
  OTHER = 'other',
}
