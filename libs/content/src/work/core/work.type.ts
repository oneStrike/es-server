import type { Work } from '@db/schema'

export type CreateWorkInput = Pick<
  Work,
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
      Work,
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

export type UpdateWorkInput = Pick<Work, 'id'> &
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
  isPublished?: boolean
  serialStatus?: number
  language?: string
  region?: string
  ageRating?: string
  isRecommended?: boolean
  isHot?: boolean
  isNew?: boolean
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

export type UpdateWorkStatusInput = Pick<Work, 'id' | 'isPublished'>
