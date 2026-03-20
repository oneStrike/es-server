import type { WorkChapter } from '@db/schema'

export type CreateWorkChapterInput = Pick<
  WorkChapter,
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
      WorkChapter,
      | 'subtitle'
      | 'cover'
      | 'description'
      | 'requiredViewLevelId'
      | 'publishAt'
      | 'content'
      | 'remark'
    >
  >

export type UpdateWorkChapterInput = Pick<WorkChapter, 'id'> &
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
