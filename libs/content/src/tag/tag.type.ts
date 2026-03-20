import type { WorkTag } from '@db/schema'

export type CreateTagInput = Pick<WorkTag, 'name'> &
  Partial<Pick<WorkTag, 'icon' | 'sortOrder' | 'isEnabled' | 'description'>>

export type UpdateTagInput = Pick<WorkTag, 'id'> &
  Partial<Pick<WorkTag, 'name' | 'icon' | 'sortOrder' | 'isEnabled' | 'description'>>

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
