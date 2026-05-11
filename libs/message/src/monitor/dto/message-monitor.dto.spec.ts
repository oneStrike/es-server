import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import {
  MessageDispatchPageItemDto,
  MessageNotificationDeliveryItemDto,
  QueryMessageDispatchPageDto,
  RetryMessageNotificationDeliveryDto,
} from './message-monitor.dto'

function validateDto<T extends object>(
  dtoClass: new () => T,
  payload: Record<string, unknown>,
) {
  return validateSync(plainToInstance(dtoClass, payload), {
    forbidUnknownValues: false,
  })
}

function validationProperties(errors: Array<{ property: string }>) {
  return errors.map((item) => item.property)
}

function createDeliveryItemPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    eventId: '10001',
    dispatchId: '10088',
    eventKey: 'comment.replied',
    categoryKey: 'comment_reply',
    categoryLabel: '评论回复',
    receiverUserId: null,
    projectionKey: null,
    notificationId: null,
    status: 2,
    statusLabel: '投递失败',
    taskId: null,
    instanceId: null,
    reminderKind: null,
    templateId: null,
    usedTemplate: false,
    fallbackReason: null,
    failureReason: null,
    lastAttemptAt: new Date('2026-03-28T15:34:33.000Z'),
    createdAt: new Date('2026-03-28T15:34:33.000Z'),
    updatedAt: new Date('2026-03-28T15:35:10.000Z'),
    ...overrides,
  }
}

function createDispatchPageItemPayload(
  overrides: Record<string, unknown> = {},
) {
  return {
    dispatchId: '10088',
    eventId: '10001',
    consumer: 'notification',
    dispatchStatus: 0,
    retryCount: 0,
    lastError: null,
    nextRetryAt: null,
    processedAt: null,
    eventKey: 'comment.replied',
    domain: 'message',
    receiverUserId: null,
    projectionKey: null,
    deliveryStatus: null,
    ...overrides,
  }
}

describe('QueryMessageDispatchPageDto', () => {
  it.each([
    ['dispatchStatus', { dispatchStatus: 'bad' }],
    ['deliveryStatus', { deliveryStatus: 'bad' }],
  ])('keeps request validation for status filter: %s', (fieldName, payload) => {
    const errors = validateDto(QueryMessageDispatchPageDto, payload)

    expect(validationProperties(errors)).toContain(fieldName)
  })
})

describe('RetryMessageNotificationDeliveryDto', () => {
  it.each([
    ['missing value', {}],
    ['blank string', { dispatchId: '   ' }],
    ['zero', { dispatchId: '0' }],
    ['negative number', { dispatchId: '-1' }],
    ['decimal number', { dispatchId: '1.5' }],
    ['non-numeric string', { dispatchId: 'abc' }],
  ])('rejects invalid dispatchId: %s', (_name, payload) => {
    const errors = validateDto(RetryMessageNotificationDeliveryDto, payload)

    expect(validationProperties(errors)).toContain('dispatchId')
  })

  it('accepts positive bigint string dispatchId', () => {
    const errors = validateDto(RetryMessageNotificationDeliveryDto, {
      dispatchId: '10088',
    })

    expect(errors).toHaveLength(0)
  })
})

describe('MessageNotificationDeliveryItemDto', () => {
  it('accepts nullable task reminder fields from the delivery output contract', () => {
    const errors = validateDto(
      MessageNotificationDeliveryItemDto,
      createDeliveryItemPayload(),
    )

    expect(errors).toHaveLength(0)
  })

  it('keeps validators on fields shared by request and response DTOs', () => {
    const errors = validateDto(
      MessageNotificationDeliveryItemDto,
      createDeliveryItemPayload({
        eventId: 10001,
        dispatchId: 10088,
        eventKey: 123,
        receiverUserId: 'bad',
        projectionKey: 123,
        status: 'bad',
      }),
    )

    expect(validationProperties(errors)).toEqual(
      expect.arrayContaining([
        'eventId',
        'dispatchId',
        'eventKey',
        'receiverUserId',
        'projectionKey',
        'status',
      ]),
    )
  })

  it('does not attach request validators to output-only delivery fields', () => {
    const errors = validateDto(
      MessageNotificationDeliveryItemDto,
      createDeliveryItemPayload({
        id: 'bad',
        taskId: 'bad',
        instanceId: 'bad',
        reminderKind: 123,
        usedTemplate: 'bad',
        lastAttemptAt: 'bad',
        createdAt: 'bad',
        updatedAt: 'bad',
      }),
    )

    expect(errors).toHaveLength(0)
  })
})

describe('MessageDispatchPageItemDto', () => {
  it('keeps validators on status fields shared by request and response DTOs', () => {
    const errors = validateDto(
      MessageDispatchPageItemDto,
      createDispatchPageItemPayload({
        dispatchStatus: 'bad',
        deliveryStatus: 'bad',
      }),
    )

    expect(validationProperties(errors)).toEqual(
      expect.arrayContaining(['dispatchStatus', 'deliveryStatus']),
    )
  })

  it('does not attach request validators to output-only dispatch page fields', () => {
    const errors = validateDto(
      MessageDispatchPageItemDto,
      createDispatchPageItemPayload({
        consumer: 123,
        retryCount: 'bad',
        lastError: 123,
        nextRetryAt: 'bad',
        processedAt: 'bad',
      }),
    )

    expect(errors).toHaveLength(0)
  })
})
