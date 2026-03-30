import type { WorkTagSelect } from '@db/schema'

export type CreateTagInput = Pick<WorkTagSelect, 'name'> &
  Partial<Pick<WorkTagSelect, 'icon' | 'sortOrder' | 'isEnabled' | 'description'>>

export type UpdateTagInput = Pick<WorkTagSelect, 'id'> &
  Partial<Pick<WorkTagSelect, 'name' | 'icon' | 'sortOrder' | 'isEnabled' | 'description'>>

export interface QueryTagInput {
  name?: string
  isEnabled?: boolean
  orderBy?: string
  pageIndex?: number
  pageSize?: number
}

/**
 * 标签排序交换入参。
 * - 通过拖拽源与目标 id 交换 sortOrder
 */
export interface UpdateTagSortInput {
  dragId: number
  targetId: number
}

/**
 * 标签删除入参。
 * - 用于按 id 删除单个标签
 */
export interface DeleteTagInput {
  id: number
}
