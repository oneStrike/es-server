import type { WorkCategory } from '@db/schema'

/**
 * 创建分类输入
 *
 * name 为必填字段，其余字段可选。
 */
export type CreateCategoryInput = Pick<WorkCategory, 'name'> &
  Partial<Pick<WorkCategory, 'icon' | 'contentType' | 'description' | 'sortOrder' | 'isEnabled'>>

/**
 * 更新分类输入
 *
 * 所有可更新字段均为可选，支持部分更新。
 */
export type UpdateCategoryInput = Pick<WorkCategory, 'id'> &
  Partial<Pick<WorkCategory, 'name' | 'icon' | 'contentType' | 'description' | 'sortOrder' | 'isEnabled'>>

/**
 * 分页查询分类输入
 *
 * contentType 为 JSON 序列化的数字数组字符串，用于 PostgreSQL 数组重叠查询。
 */
export interface QueryCategoryInput {
  name?: string
  isEnabled?: boolean
  contentType?: string
  orderBy?: string
  pageIndex?: number
  pageSize?: number
}

/**
 * 分类 ID 输入
 *
 * 用于详情查询、删除等单 ID 场景。
 */
export type CategoryIdInput = Pick<WorkCategory, 'id'>

/**
 * 更新分类启用状态输入
 */
export type UpdateCategoryStatusInput = Pick<WorkCategory, 'id' | 'isEnabled'>

/**
 * 交换分类排序输入
 *
 * dragId 为被拖拽项，targetId 为目标位置项。
 */
export interface UpdateCategorySortInput {
  dragId: number
  targetId: number
}
