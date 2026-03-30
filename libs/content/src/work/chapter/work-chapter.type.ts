import type { WorkChapterSelect } from '@db/schema'

export type CreateWorkChapterInput = Pick<
  WorkChapterSelect,
  | 'workId'
  | 'workType'
  | 'title'
  | 'sortOrder'
  | 'viewRule'
  | 'price'
  | 'canDownload'
  | 'isPublished'
  | 'isPreview'
  | 'canComment'
> &
Partial<
    Pick<
      WorkChapterSelect,
      | 'subtitle'
      | 'cover'
      | 'description'
      | 'requiredViewLevelId'
      | 'publishAt'
      | 'content'
      | 'remark'
    >
  >

export type UpdateWorkChapterInput = Pick<WorkChapterSelect, 'id'> &
  Partial<Omit<CreateWorkChapterInput, 'workId' | 'workType'>>

export interface QueryWorkChapterInput {
  workId: number
  title?: string
  isPublished?: boolean
  isPreview?: boolean
  viewRule?: number
  canDownload?: boolean
  canComment?: boolean
  pageIndex?: number
  pageSize?: number
  orderBy?: string
}

/**
 * 章节拖拽排序入参。
 * - 通过 dragId 与 targetId 在同作品下交换章节顺序
 */
export interface SwapWorkChapterNumbersInput {
  dragId: number
  targetId: number
}

export interface WorkChapterDetailContext {
  userId?: number
  ipAddress?: string
  device?: string
}
