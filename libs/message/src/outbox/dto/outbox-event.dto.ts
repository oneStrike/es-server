import type { Prisma } from '@libs/base/database'

export interface NotificationOutboxPayload {
  receiverUserId: number
  actorUserId?: number
  type: string
  targetType?: number
  targetId?: number
  subjectType?: string
  subjectId?: number
  title: string
  content: string
  payload?: Prisma.InputJsonValue
  aggregateKey?: string
  aggregateCount?: number
  expiredAt?: Date | string
}

export interface CreateMessageOutboxEventDto {
  domain: string
  eventType: string
  bizKey: string
  payload: Prisma.InputJsonValue
}

export interface CreateNotificationOutboxEventDto {
  eventType: string
  bizKey: string
  payload: NotificationOutboxPayload
}
