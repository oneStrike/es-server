import { BadRequestException } from '@nestjs/common'
import {
  MessageNotificationTypeEnum,
} from '../notification/notification.constant'
import {
  MessageOutboxDomainEnum,
  MessageOutboxStatusEnum,
} from './outbox.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('message outbox service', () => {
  it('derives notification eventType from payload.type when enqueueing single event', async () => {
    const { MessageOutboxService } = await import('./outbox.service')

    const onConflictDoNothing = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ onConflictDoNothing }))
    const insert = jest.fn(() => ({ values }))
    const tx = { insert }
    const service = new MessageOutboxService({
      schema: {
        messageOutbox: {
          bizKey: 'bizKey',
        },
      },
    } as any)

    await service.enqueueNotificationEventInTx(tx as any, {
      bizKey: 'notify:topic-like:topic:8:actor:1002:receiver:1001',
      payload: {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_LIKE,
        targetId: 8,
        title: '你的主题收到点赞',
        content: '有人点赞了你的主题',
      },
    })

    expect(values).toHaveBeenCalledWith({
      domain: MessageOutboxDomainEnum.NOTIFICATION,
      eventType: MessageNotificationTypeEnum.TOPIC_LIKE,
      bizKey: 'notify:topic-like:topic:8:actor:1002:receiver:1001',
      payload: {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_LIKE,
        targetId: 8,
        title: '你的主题收到点赞',
        content: '有人点赞了你的主题',
      },
      status: MessageOutboxStatusEnum.PENDING,
    })
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: 'bizKey',
    })
  })

  it('rejects mismatched notification eventType during compatibility window', async () => {
    const { MessageOutboxService } = await import('./outbox.service')

    const service = new MessageOutboxService({
      schema: {
        messageOutbox: {
          bizKey: 'bizKey',
        },
      },
    } as any)

    await expect(
      service.enqueueNotificationEventInTx({ insert: jest.fn() } as any, {
        eventType: MessageNotificationTypeEnum.COMMENT_LIKE,
        bizKey: 'notify:topic-like:topic:8:actor:1002:receiver:1001',
        payload: {
          receiverUserId: 1001,
          type: MessageNotificationTypeEnum.TOPIC_LIKE,
          title: '你的主题收到点赞',
          content: '有人点赞了你的主题',
        },
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('derives notification eventType from payload.type when enqueueing batched events', async () => {
    const { MessageOutboxService } = await import('./outbox.service')

    const onConflictDoNothing = jest.fn().mockResolvedValue(undefined)
    const values = jest.fn(() => ({ onConflictDoNothing }))
    const insert = jest.fn(() => ({ values }))
    const tx = { insert }
    const service = new MessageOutboxService({
      schema: {
        messageOutbox: {
          bizKey: 'bizKey',
        },
      },
    } as any)

    await service.enqueueNotificationEventsInTx(tx as any, [
      {
        bizKey: 'notify:topic-like:topic:8:actor:1002:receiver:1001',
        payload: {
          receiverUserId: 1001,
          type: MessageNotificationTypeEnum.TOPIC_LIKE,
          title: '你的主题收到点赞',
          content: '有人点赞了你的主题',
        },
      },
      {
        eventType: MessageNotificationTypeEnum.TOPIC_FAVORITE,
        bizKey: 'notify:topic-favorite:topic:9:actor:1003:receiver:1001',
        payload: {
          receiverUserId: 1001,
          type: MessageNotificationTypeEnum.TOPIC_FAVORITE,
          title: '你的主题被收藏了',
          content: '有人收藏了你的主题',
        },
      },
    ])

    expect(values).toHaveBeenCalledWith([
      {
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType: MessageNotificationTypeEnum.TOPIC_LIKE,
        bizKey: 'notify:topic-like:topic:8:actor:1002:receiver:1001',
        payload: {
          receiverUserId: 1001,
          type: MessageNotificationTypeEnum.TOPIC_LIKE,
          title: '你的主题收到点赞',
          content: '有人点赞了你的主题',
        },
        status: MessageOutboxStatusEnum.PENDING,
      },
      {
        domain: MessageOutboxDomainEnum.NOTIFICATION,
        eventType: MessageNotificationTypeEnum.TOPIC_FAVORITE,
        bizKey: 'notify:topic-favorite:topic:9:actor:1003:receiver:1001',
        payload: {
          receiverUserId: 1001,
          type: MessageNotificationTypeEnum.TOPIC_FAVORITE,
          title: '你的主题被收藏了',
          content: '有人收藏了你的主题',
        },
        status: MessageOutboxStatusEnum.PENDING,
      },
    ])
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: 'bizKey',
    })
  })
})
