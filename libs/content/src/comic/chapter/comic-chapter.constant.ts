/**
 * 漫画章节模块常量定义
 */

/// 章节发布状态枚举
export enum ChapterPublishStatusEnum {
  /** 未发布 */
  UNPUBLISHED = 0,
  /** 已发布 */
  PUBLISHED = 1,
}

/// 章节类型枚举
export enum ChapterTypeEnum {
  /** 正常章节 */
  NORMAL = 0,
  /** 试读章节 */
  PREVIEW = 1,
}

export const ComicChapterGrowthEventKey = {
  Read: 'comic.chapter.read',
  Like: 'comic.chapter.like',
  Purchase: 'comic.chapter.purchase',
  Download: 'comic.chapter.download',
} as const
