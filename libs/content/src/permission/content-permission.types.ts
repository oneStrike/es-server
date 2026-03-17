import type { appUser, work, workChapter } from '@db/schema'
import type { WorkViewPermissionEnum } from '@libs/platform/constant'

export type UserWithLevel = typeof appUser.$inferSelect & {
  level: { requiredExperience: number } | null
}

export type PermissionChapterData = Pick<
  typeof workChapter.$inferSelect,
  | 'workId'
  | 'workType'
  | 'viewRule'
  | 'requiredViewLevelId'
  | 'price'
  | 'canDownload'
  | 'canComment'
  | 'isPreview'
> & {
  requiredViewLevel: { requiredExperience: number } | null
}

export type WorkPermissionData = Pick<
  typeof work.$inferSelect,
  'viewRule' | 'requiredViewLevelId' | 'chapterPrice' | 'canComment'
> & {
  requiredViewLevel: { requiredExperience: number } | null
}

export interface AccessRuleContext {
  scope: 'work' | 'chapter'
  requiredExperience: number | null
  viewRule: WorkViewPermissionEnum
  isPreview?: boolean
  chapterId?: number
}
