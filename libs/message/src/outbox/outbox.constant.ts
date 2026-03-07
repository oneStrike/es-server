/**
 * 消息发件箱领域枚举
 * 统一使用 SmallInt 存储
 */
export enum MessageOutboxDomainEnum {
  /** 通知领域 */
  NOTIFICATION = 1,
  /** 聊天领域 */
  CHAT = 2,
}

/**
 * 消息发件箱状态枚举
 * 统一使用 SmallInt 存储
 */
export enum MessageOutboxStatusEnum {
  /** 待处理 */
  PENDING = 1,
  /** 处理中 */
  PROCESSING = 2,
  /** 处理成功 */
  SUCCESS = 3,
  /** 处理失败 */
  FAILED = 4,
}

/** 发件箱批量处理大小 */
export const MESSAGE_OUTBOX_BATCH_SIZE = 100
/** 发件箱最大重试次数 */
export const MESSAGE_OUTBOX_MAX_RETRY = 5
