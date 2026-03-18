import { InteractionTargetTypeEnum } from '@libs/platform/constant'
import { DownloadTargetTypeEnum } from './download.constant'

/**
 * 下载模块本地目标类型到系统级交互目标语义的映射。
 */
export const DOWNLOAD_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP: Record<
  DownloadTargetTypeEnum,
  InteractionTargetTypeEnum
> = {
  [DownloadTargetTypeEnum.COMIC_CHAPTER]:
    InteractionTargetTypeEnum.COMIC_CHAPTER,
  [DownloadTargetTypeEnum.NOVEL_CHAPTER]:
    InteractionTargetTypeEnum.NOVEL_CHAPTER,
}

export function mapDownloadTargetTypeToInteractionTargetType(
  targetType: DownloadTargetTypeEnum,
): InteractionTargetTypeEnum {
  return DOWNLOAD_TARGET_TYPE_TO_INTERACTION_TARGET_TYPE_MAP[targetType]
}
