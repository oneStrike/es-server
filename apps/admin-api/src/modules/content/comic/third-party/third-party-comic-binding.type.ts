import type { BackgroundTaskObject } from '@libs/platform/modules/background-task/types'

/** 三方漫画来源作用域字段，供绑定幂等和同步任务去重复用。 */
export type ThirdPartyComicSourceScopeInput = {
  platform: string
  providerComicId: string
  providerGroupPathWord: string
}

/** 创建或复用作品三方来源绑定的内部输入。 */
export type ThirdPartyComicSourceBindingInput =
  ThirdPartyComicSourceScopeInput & {
    workId: number
    providerPathWord: string
    providerUuid?: string | null
    sourceSnapshot: BackgroundTaskObject
  }

/** 创建或复用作品章节三方绑定的内部输入。 */
export type ThirdPartyComicChapterBindingInput = {
  workThirdPartySourceBindingId: number
  chapterId: number
  providerChapterId: string
  remoteSortOrder?: number | null
  snapshot: BackgroundTaskObject
}

/** 三方漫画绑定写入结果，标记本次是否真实创建。 */
export type ThirdPartyComicBindingMutationResult = {
  id: number
  created: boolean
}
