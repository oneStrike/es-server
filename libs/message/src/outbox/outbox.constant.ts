export enum MessageOutboxDomainEnum {
  NOTIFICATION = 'notification',
  CHAT = 'chat',
}

export enum MessageOutboxStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export const MESSAGE_OUTBOX_BATCH_SIZE = 100
export const MESSAGE_OUTBOX_MAX_RETRY = 5
