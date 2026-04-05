import type { appUser, work, workChapter } from '@db/schema'
import type { WorkViewPermissionEnum } from '@libs/platform/constant'

/**
 * 携带等级快照的用户结构。
 * 供会员权限校验复用，避免 service 内部散落临时对象类型。
 */
export type UserWithLevel = typeof appUser.$inferSelect & {
  level: { requiredExperience: number } | null
}

/**
 * 章节权限判定所需的最小章节快照。
 * 字段范围控制在权限、价格和功能开关相关字段，避免把整章实体在权限链路里到处透传。
 */
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

/**
 * 作品权限判定所需的最小作品快照。
 * 主要用于章节继承作品权限时，统一读取父级规则。
 */
export type WorkPermissionData = Pick<
  typeof work.$inferSelect,
  'viewRule' | 'requiredViewLevelId' | 'chapterPrice' | 'canComment'
> & {
  requiredViewLevel: { requiredExperience: number } | null
}

/**
 * 统一的访问规则上下文。
 * 作品阅读、章节阅读和章节下载都会先整理成这个结构，再进入同一套权限判断流程。
 */
export interface AccessRuleContext {
  scope: 'work' | 'chapter'
  requiredExperience: number | null
  viewRule: WorkViewPermissionEnum
  isPreview?: boolean
  chapterId?: number
}
