import type { WorkCategory } from '@db/schema'

export type CreateCategoryInput = Pick<WorkCategory, 'name'> &
  Partial<Pick<WorkCategory, 'icon' | 'contentType' | 'description' | 'sortOrder' | 'isEnabled'>>

export type UpdateCategoryInput = Pick<WorkCategory, 'id'> &
  Partial<Pick<WorkCategory, 'name' | 'icon' | 'contentType' | 'description' | 'sortOrder' | 'isEnabled'>>

export interface QueryCategoryInput {
  name?: string
  isEnabled?: boolean
  contentType?: string
  orderBy?: string
  pageIndex?: number
  pageSize?: number
}

export type CategoryIdInput = Pick<WorkCategory, 'id'>

export type UpdateCategoryStatusInput = Pick<WorkCategory, 'id' | 'isEnabled'>

export interface UpdateCategorySortInput {
  dragId: number
  targetId: number
}
