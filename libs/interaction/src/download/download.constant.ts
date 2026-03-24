export enum DownloadTargetTypeEnum {
  /** 漫画章节 */
  COMIC_CHAPTER = 1,
  /** 小说章节 */
  NOVEL_CHAPTER = 2,
}

export const DOWNLOAD_WORK_CHAPTER_TARGET_TYPES = [
  DownloadTargetTypeEnum.COMIC_CHAPTER,
  DownloadTargetTypeEnum.NOVEL_CHAPTER,
] as const
