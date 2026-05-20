import type { HydratedThirdPartyComicImportChapterItem } from '@libs/content/work/third-party/third-party-comic-import.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'

export type ThirdPartyComicImportImageTotalSource = Pick<
  HydratedThirdPartyComicImportChapterItem,
  'imageCount' | 'importImages' | 'providerChapterId'
>

export function resolveThirdPartyComicImportImageTotal(
  chapter: ThirdPartyComicImportImageTotalSource,
) {
  if (
    typeof chapter.imageCount !== 'number' ||
    !Number.isFinite(chapter.imageCount) ||
    !Number.isInteger(chapter.imageCount) ||
    chapter.imageCount < 0
  ) {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      `三方章节图片数必须是非负整数: ${chapter.providerChapterId}`,
    )
  }

  if (!chapter.importImages) {
    return 0
  }

  return chapter.imageCount
}

export function resolveThirdPartyComicImportImageTotals(
  chapters: ThirdPartyComicImportImageTotalSource[],
) {
  return chapters.map((chapter) =>
    resolveThirdPartyComicImportImageTotal(chapter),
  )
}
