/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import { chatConversation, chatConversationMember, chatMessage, userNotification } from '@db/schema'
import { BadRequestException } from '@nestjs/common'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { MessageInboxService } from './inbox.service'

const dialect = new PgDialect()

describe('MessageInboxService unread summary', () => {
  it('builds the user-center unread summary without reading latest messages', async () => {
    const summaryQueryService = {
      getNotificationUnreadSummary: jest.fn(async () => [
        { categoryKey: 'comment_reply', count: 2 },
        { categoryKey: 'system_announcement', count: 1 },
      ]),
      getChatUnreadAggregate: jest.fn(async () => [{ unreadCount: 4 }]),
      getLatestNotification: jest.fn(),
      getLatestConversation: jest.fn(),
      getLatestChatMessage: jest.fn(),
    }
    const service = new MessageInboxService(
      {} as never,
      summaryQueryService as never,
    )

    await expect(service.getUnreadSummary(7)).resolves.toMatchObject({
      notificationUnread: {
        total: 3,
        byCategory: {
          comment_reply: 2,
          system_announcement: 1,
        },
      },
      chatUnreadCount: 4,
      totalUnreadCount: 7,
    })
    expect(
      summaryQueryService.getNotificationUnreadSummary,
    ).toHaveBeenCalledWith({
      userId: 7,
      now: expect.any(Date),
    })
    expect(summaryQueryService.getChatUnreadAggregate).toHaveBeenCalledWith({
      userId: 7,
    })
    expect(summaryQueryService.getLatestNotification).not.toHaveBeenCalled()
    expect(summaryQueryService.getLatestConversation).not.toHaveBeenCalled()
    expect(summaryQueryService.getLatestChatMessage).not.toHaveBeenCalled()
  })
})

describe('MessageInboxService timeline', () => {
  function createTimelineBuilder(rows: Record<string, unknown>[]) {
    const whereConditions: unknown[] = []
    const orderByExpressions: unknown[] = []
    const builder: Record<string, jest.Mock> = {}

    builder.from = jest.fn(() => builder)
    builder.innerJoin = jest.fn(() => builder)
    builder.leftJoin = jest.fn(() => builder)
    builder.where = jest.fn((condition: unknown) => {
      whereConditions.push(condition)
      return builder
    })
    builder.orderBy = jest.fn((...expressions: unknown[]) => {
      orderByExpressions.push(...expressions)
      return builder
    })
    builder.limit = jest.fn(() => Promise.resolve(rows))
    builder.offset = jest.fn()

    return {
      builder,
      sqlText: () =>
        [...whereConditions, ...orderByExpressions]
          .map((expression) => dialect.sqlToQuery(expression as never).sql)
          .join('\n')
          .toLowerCase(),
    }
  }

  function createTimelineService(
    notificationRows: Record<string, unknown>[] = [],
    chatRows: Record<string, unknown>[] = [],
  ) {
    const notificationBuilder = createTimelineBuilder(notificationRows)
    const chatBuilder = createTimelineBuilder(chatRows)
    const execute = jest.fn()
    const select = jest
      .fn()
      .mockImplementationOnce(() => notificationBuilder.builder)
      .mockImplementationOnce(() => chatBuilder.builder)
    const drizzle = {
      db: {
        execute,
        select,
      },
      schema: {
        chatConversation,
        chatConversationMember,
        chatMessage,
        userNotification,
      },
    } as unknown as DrizzleService
    const service = new MessageInboxService(drizzle, {} as never)

    return {
      service,
      mocks: {
        chatBuilder,
        execute,
        notificationBuilder,
        select,
      },
    }
  }

  it('merges bounded notification and chat candidates without raw combined deep paging', async () => {
    const { service, mocks } = createTimelineService(
      [
        {
          sourceType: 'notification',
          createdAt: new Date('2026-03-07T12:01:00.000Z'),
          title: '通知-10',
          content: '通知内容',
          bizId: 'n:10',
        },
        {
          sourceType: 'notification',
          createdAt: new Date('2026-03-07T11:59:00.000Z'),
          title: '通知-9',
          content: '旧通知',
          bizId: 'n:9',
        },
      ],
      [
        {
          sourceType: 'chat',
          createdAt: new Date('2026-03-07T12:02:00.000Z'),
          title: '新聊天消息',
          content: '聊天内容',
          bizId: 'c:4',
        },
        {
          sourceType: 'chat',
          createdAt: new Date('2026-03-07T12:01:00.000Z'),
          title: '新聊天消息',
          content: '同时间聊天',
          bizId: 'c:9',
        },
      ],
    )

    const page = await service.getTimeline(7, {
      pageSize: 2,
    })

    expect(page).toMatchObject({
      list: [
        {
          sourceType: 'chat',
          title: '新聊天消息',
          bizId: 'c:4',
        },
        {
          sourceType: 'notification',
          title: '通知-10',
          bizId: 'n:10',
        },
      ],
      hasMore: true,
      pageSize: 2,
    })
    expect(page.nextCursor).toEqual(expect.any(String))
    expect(
      JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString('utf8')),
    ).toMatchObject({
      createdAt: '2026-03-07T12:01:00.000Z',
      bizId: 'n:10',
    })
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.select).toHaveBeenCalledTimes(2)
    expect(mocks.notificationBuilder.builder.limit).toHaveBeenCalledWith(3)
    expect(mocks.chatBuilder.builder.limit).toHaveBeenCalledWith(3)
    expect(mocks.notificationBuilder.builder.offset).not.toHaveBeenCalled()
    expect(mocks.chatBuilder.builder.offset).not.toHaveBeenCalled()
    const generatedSql = [
      mocks.notificationBuilder.sqlText(),
      mocks.chatBuilder.sqlText(),
    ].join('\n')
    expect(generatedSql).not.toContain(['union', 'all'].join(' '))
    expect(generatedSql).not.toContain(['off', 'set'].join(''))
  })

  it('rejects invalid cursors before querying timeline candidates', async () => {
    const { service, mocks } = createTimelineService()
    const invalidCursor = Buffer.from(
      JSON.stringify({ createdAt: 'not-a-date', bizId: 'bad' }),
    ).toString('base64url')

    await expect(
      service.getTimeline(7, {
        cursor: invalidCursor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('rejects legacy page and ordering parameters on the cursor timeline', async () => {
    const { service, mocks } = createTimelineService()

    await expect(
      service.getTimeline(7, {
        pageIndex: 2,
        pageSize: 15,
      } as never),
    ).rejects.toThrow('消息时间线仅支持 pageSize 和 cursor 查询')
    expect(mocks.select).not.toHaveBeenCalled()
  })
})
