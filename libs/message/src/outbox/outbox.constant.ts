/**
 * Outbox domain enum
 */
export enum MessageOutboxDomainEnum {
  NOTIFICATION = 1,
  CHAT = 2,
}

/**
 * Outbox status enum
 */
export enum MessageOutboxStatusEnum {
  PENDING = 1,
  PROCESSING = 2,
  SUCCESS = 3,
  FAILED = 4,
}

/** Batch size per polling cycle */
export const MESSAGE_OUTBOX_BATCH_SIZE = 100
/** Max retry count before giving up */
export const MESSAGE_OUTBOX_MAX_RETRY = 5
/** Processing timeout in seconds for stale lock recovery */
export const MESSAGE_OUTBOX_PROCESSING_TIMEOUT_SECONDS = 120
