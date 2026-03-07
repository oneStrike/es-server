/**
 * 消息发件箱领域枚举
 * 定义发件箱事件所属的业务领域
 */
export enum MessageOutboxDomainEnum {
  /** 通知领域 */
  NOTIFICATION = 'notification',
  /** 聊天领域 */
  CHAT = 'chat',
}

/**
 * 消息发件箱状态枚举
 * 定义发件箱事件的处理状态
 */
export enum MessageOutboxStatusEnum {
  /** 待处理 */
  PENDING = 'PENDING',
  /** 处理中 */
  PROCESSING = 'PROCESSING',
  /** 处理成功 */
  SUCCESS = 'SUCCESS',
  /** 处理失败 */
  FAILED = 'FAILED',
}

/** 发件箱批量处理大小 */
export const MESSAGE_OUTBOX_BATCH_SIZE = 100
/** 发件箱最大重试次数 */
export const MESSAGE_OUTBOX_MAX_RETRY = 5
