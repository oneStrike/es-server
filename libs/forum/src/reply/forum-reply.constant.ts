/**
 * 论坛回复审核状态枚举
 */
// 从 libs/platform 重新导出
export { AuditStatusEnum, SortOrderEnum } from '@libs/platform/constant'

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
