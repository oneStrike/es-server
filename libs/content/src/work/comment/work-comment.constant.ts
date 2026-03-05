/// 评论审核状态枚举
// 从 libs/base 重新导出
export {
  AuditRoleEnum,
  AuditStatusEnum,
  ReportStatusEnum,
  SortOrderEnum,
} from '@libs/base/constant'

/// 评论排序字段枚举
export enum WorkCommentSortFieldEnum {
  /** 创建时间 */
  CREATED_AT = 'createdAt',
  /** 楼层号 */
  FLOOR = 'floor',
}
