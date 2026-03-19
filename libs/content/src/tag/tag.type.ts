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
