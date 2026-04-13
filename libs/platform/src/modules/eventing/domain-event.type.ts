import type { DomainEventConsumerEnum, DomainEventDispatchStatusEnum } from './eventing.constant'

export interface DomainEventRecord {
  id: bigint
  eventKey: string
  domain: string
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
  status: DomainEventDispatchStatusEnum | string
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
  event: DomainEventRecord
  dispatches: DomainEventDispatchRecord[]
}
