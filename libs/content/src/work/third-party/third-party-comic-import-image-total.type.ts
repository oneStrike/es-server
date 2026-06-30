import type { HydratedThirdPartyComicImportChapterItem } from '@libs/content/work/third-party/third-party-comic-import.type'

/**
 * 计算三方漫画导入图片总数所需的章节字段。
 */
export type ThirdPartyComicImportImageTotalSource = Pick<
  HydratedThirdPartyComicImportChapterItem,
  'imageCount' | 'importImages' | 'providerChapterId'
>
