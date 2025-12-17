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
