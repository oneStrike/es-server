import type { WorkSelect } from '@db/schema'

export type CreateWorkInput = Pick<
  WorkSelect,
  | 'type'
  | 'name'
  | 'cover'
  | 'description'
  | 'language'
  | 'region'
  | 'serialStatus'
  | 'viewRule'
  | 'chapterPrice'
> &
Partial<
    Pick<
      WorkSelect,
      | 'alias'
      | 'ageRating'
      | 'publisher'
      | 'originalSource'
      | 'copyright'
      | 'disclaimer'
      | 'remark'
      | 'isPublished'
      | 'lastUpdated'
      | 'requiredViewLevelId'
      | 'canComment'
      | 'isRecommended'
      | 'isHot'
      | 'isNew'
      | 'recommendWeight'
    >
  > & {
    publishAt?: Date | string | null
    authorIds: number[]
    categoryIds: number[]
    tagIds: number[]
  }

export type UpdateWorkInput = Pick<WorkSelect, 'id'> &
  Partial<Omit<CreateWorkInput, 'type' | 'authorIds' | 'categoryIds' | 'tagIds'>> & {
    authorIds?: number[]
    categoryIds?: number[]
    tagIds?: number[]
  }

export interface QueryWorkInput {
  type?: number
  name?: string
  publisher?: string
  author?: string
  authorId?: number
  isPublished?: boolean
  serialStatus?: number
  language?: string
  region?: string
  ageRating?: string
  isRecommended?: boolean
  isHot?: boolean
  isNew?: boolean
  categoryIds?: number[]
  tagIds?: number[]
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

export interface QueryWorkTypeInput {
  type: number
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

export type UpdateWorkStatusInput = Pick<WorkSelect, 'id' | 'isPublished'>
