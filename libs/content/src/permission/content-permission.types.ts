import type { WorkViewPermissionEnum } from '@libs/platform/constant'
import type { Prisma } from '@libs/platform/database'
import type {
  CHAPTER_PERMISSION_SELECT,
  WORK_PERMISSION_SELECT,
} from './content-permission.select'

export type UserWithLevel = Prisma.AppUserGetPayload<{
  include: {
    level: {
      select: {
        requiredExperience: true
      }
    }
  }
}>

export type PermissionChapterData = Prisma.WorkChapterGetPayload<{
  select: typeof CHAPTER_PERMISSION_SELECT
}>

export type WorkPermissionData = Prisma.WorkGetPayload<{
  select: typeof WORK_PERMISSION_SELECT
}>

export interface AccessRuleContext {
  scope: 'work' | 'chapter'
  requiredExperience: number | null
  viewRule: WorkViewPermissionEnum
  isPreview?: boolean
  chapterId?: number
}
