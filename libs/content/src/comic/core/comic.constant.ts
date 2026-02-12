/**
 * 漫画模块常量定义
 */

/// 漫画连载状态枚举
export enum ComicSerialStatusEnum {
  /** 连载中 */
  SERIALIZING = 0,
  /** 已完结 */
  COMPLETED = 1,
  /** 暂停连载 */
  PAUSED = 2,
  /** 已停更 */
  DISCONTINUED = 3,
}

/// 漫画成长事件 Key
export const ComicGrowthEventKey = {
  /** 漫画浏览 */
  View: 'comic.work.view',
  /** 漫画点赞 */
  Like: 'comic.work.like',
  /** 漫画收藏 */
  Favorite: 'comic.work.favorite',
} as const
