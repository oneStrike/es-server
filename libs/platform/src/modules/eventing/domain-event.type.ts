import type {
  DomainEventConsumerEnum,
  DomainEventDispatchStatusEnum,
} from './eventing.constant'

/** 稳定领域类型 `DomainEventRecord`。仅供内部领域/服务链路复用，避免重复定义。 */
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

/** 稳定领域类型 `DomainEventDispatchRecord`。仅供内部领域/服务链路复用，避免重复定义。 */
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

/** 稳定领域类型 `PublishDomainEventInput`。仅供内部领域/服务链路复用，避免重复定义。 */
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

/** 稳定领域类型 `PublishDomainEventResult`。仅供内部领域/服务链路复用，避免重复定义。 */
export interface PublishDomainEventResult {
  duplicated: boolean
  event: DomainEventRecord
  dispatches: DomainEventDispatchRecord[]
}
