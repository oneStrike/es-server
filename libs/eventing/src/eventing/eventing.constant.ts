export enum DomainEventConsumerEnum {
  NOTIFICATION = 'notification',
  CHAT_REALTIME = 'chat_realtime',
}

export enum DomainEventDispatchStatusEnum {
  PENDING = 0,
  PROCESSING = 1,
  SUCCESS = 2,
  FAILED = 3,
}

export const DOMAIN_EVENT_DISPATCH_BATCH_SIZE = 100
export const DOMAIN_EVENT_DISPATCH_MAX_RETRY = 5
export const DOMAIN_EVENT_DISPATCH_PROCESSING_TIMEOUT_SECONDS = 120
