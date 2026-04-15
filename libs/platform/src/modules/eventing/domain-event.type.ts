import type {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'

export interface DomainEventRecord {
  id: bigint
  eventKey: string
  domain: string
  idempotencyKey: string | null
  subjectType: string
  subjectId: number
  targetType: string
  targetId: number
  operatorId: number | null
  occurredAt: Date
  context: Record<string, unknown> | null
  createdAt: Date
}

export interface DomainEventDispatchRecord {
  id: bigint
  eventId: bigint
  consumer: DomainEventConsumerEnum | string
  status: DomainEventDispatchStatusEnum
  retryCount: number
  nextRetryAt: Date | null
  lastError: string | null
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface PublishDomainEventInput {
  eventKey: string
  domain: string
  idempotencyKey?: string
  subjectType: string
  subjectId: number
  targetType: string
  targetId: number
  operatorId?: number
  occurredAt?: Date
  consumers: DomainEventConsumerEnum[]
  context?: Record<string, unknown>
}

export interface PublishDomainEventResult {
  duplicated: boolean
  event: DomainEventRecord
  dispatches: DomainEventDispatchRecord[]
}
