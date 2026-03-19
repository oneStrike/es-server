import type { WorkAuthor } from '@db/schema'

/**
 * 创建作者入参。
 * - 对应作者创建表单的可写字段
 */
export type CreateAuthorInput = Pick<WorkAuthor, 'name' | 'gender'> &
  Partial<
    Pick<
      WorkAuthor,
      'type' | 'avatar' | 'description' | 'nationality' | 'remark'
    >
  >

/**
 * 更新作者基础信息入参。
 * - 通过作者ID定位记录并更新基础资料
 */
export type UpdateAuthorInput = Pick<WorkAuthor, 'id'> &
  Partial<
    Pick<WorkAuthor, 'name' | 'type' | 'gender' | 'avatar' | 'description' | 'nationality' | 'remark'>
  >

/**
 * 作者分页查询入参。
 * - 支持基础筛选与分页参数
 */
export interface QueryAuthorInput {
  name?: string
  isEnabled?: boolean
  nationality?: string
  gender?: number
  isRecommended?: boolean
  type?: string
  pageIndex?: number
  pageSize?: number
}

/**
 * 更新作者启用状态入参。
 * - 用于上下架作者
 */
export type UpdateAuthorStatusInput = Pick<WorkAuthor, 'id' | 'isEnabled'>

/**
 * 更新作者推荐状态入参。
 * - 用于推荐位管理
 */
export type UpdateAuthorRecommendedInput = Pick<WorkAuthor, 'id' | 'isRecommended'>

/**
 * 作者主键入参。
 * - 用于详情、删除等按ID操作
 */
export type AuthorIdInput = Pick<WorkAuthor, 'id'>
