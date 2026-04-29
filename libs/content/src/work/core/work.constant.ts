/**
 * 作品连载状态枚举。
 * 与 work.serial_status 的闭合值域保持一致。
 */
export enum WorkSerialStatusEnum {
  /** 未开始连载 */
  NOT_STARTED = 0,
  /** 连载中 */
  SERIALIZING = 1,
  /** 已完结 */
  COMPLETED = 2,
  /** 暂停更新 */
  PAUSED = 3,
  /** 已停更 */
  DISCONTINUED = 4,
}
