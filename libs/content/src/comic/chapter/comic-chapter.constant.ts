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

/// 章节成长事件 Key
export const ComicChapterGrowthEventKey = {
  /** 章节阅读 */
  Read: 'comic.chapter.read',
  /** 章节点赞 */
  Like: 'comic.chapter.like',
  /** 章节购买 */
  Purchase: 'comic.chapter.purchase',
  /** 章节下载 */
  Download: 'comic.chapter.download',
} as const
