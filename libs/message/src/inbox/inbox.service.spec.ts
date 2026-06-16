/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import {
  chatConversation,
  chatConversationMember,
  chatMessage,
  userNotification,
} from '@db/schema'
import { sql } from 'drizzle-orm'
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
  function createTimelineService(
    rows: Record<string, unknown>[] = [],
    total = rows.length,
  ) {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [{ total }] })
    const buildPageParams = jest.fn(
      (dto: { pageIndex?: number; pageSize?: number }) => {
        const pageIndex = dto.pageIndex ?? 1
        const pageSize = dto.pageSize ?? 15
        return {
          page: {
            pageIndex,
            pageSize,
            limit: pageSize,
            offset: (pageIndex - 1) * pageSize,
          },
          order: {
            orderBySql: [] as unknown[],
            orderByClause: sql.raw('"createdAt" desc, "bizId" desc'),
          },
          dateRange: undefined as
            | { gte?: Date | undefined; lt?: Date | undefined }
            | undefined,
        }
      },
    )
    const drizzle = {
      db: {
        execute,
      },
      buildPageParams,
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
        buildPageParams,
        execute,
      },
    }
  }

  it('returns an ApiPage timeline from a single raw union source and count query', async () => {
    const { service, mocks } = createTimelineService(
      [
        {
          sourceType: 'chat',
          createdAt: new Date('2026-03-07T12:02:00.000Z'),
          title: '新聊天消息',
          content: '聊天内容',
          bizId: 'c:4',
        },
        {
          sourceType: 'notification',
          createdAt: new Date('2026-03-07T12:01:00.000Z'),
          title: '通知-10',
          content: '通知内容',
          bizId: 'n:10',
        },
      ],
      4,
    )

    const page = await service.getTimeline(7, {
      pageIndex: 2,
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
      pageIndex: 2,
      pageSize: 2,
      total: 4,
    })
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
    expect(mocks.buildPageParams).toHaveBeenCalledWith(
      {
        pageIndex: 2,
        pageSize: 2,
      },
      expect.objectContaining({
        defaultPageSize: 15,
        maxPageSize: 100,
        allowlistedOrderBy: expect.objectContaining({
          columns: expect.objectContaining({
            createdAt: expect.anything(),
            bizId: expect.anything(),
            id: expect.anything(),
          }),
        }),
      }),
    )
    expect(mocks.execute).toHaveBeenCalledTimes(2)
    const listSql = dialect
      .sqlToQuery(mocks.execute.mock.calls[0][0] as never)
      .sql.toLowerCase()
    const countSql = dialect
      .sqlToQuery(mocks.execute.mock.calls[1][0] as never)
      .sql.toLowerCase()
    expect(listSql).toContain(['union', 'all'].join(' '))
    expect(listSql).toContain(['order', 'by'].join(' '))
    expect(listSql).toContain('limit')
    expect(listSql).toContain(['off', 'set'].join(''))
    expect(countSql).toContain(['count', '('].join(''))
    expect(countSql).toContain(['union', 'all'].join(' '))
  })

  it('passes PageDto date range through the shared helper before SQL construction', async () => {
    const { service, mocks } = createTimelineService([], 0)
    mocks.buildPageParams.mockReturnValueOnce({
      page: {
        pageIndex: 1,
        pageSize: 15,
        limit: 15,
        offset: 0,
      },
      order: {
        orderBySql: [],
        orderByClause: sql.raw('"createdAt" desc, "bizId" desc'),
      },
      dateRange: {
        gte: new Date('2026-03-06T16:00:00.000Z'),
        lt: new Date('2026-03-07T16:00:00.000Z'),
      },
    })

    await service.getTimeline(7, {
      startDate: '2026-03-07',
      endDate: '2026-03-07',
    })

    expect(mocks.buildPageParams).toHaveBeenCalledWith(
      {
        startDate: '2026-03-07',
        endDate: '2026-03-07',
      },
      expect.any(Object),
    )
    const listSql = dialect
      .sqlToQuery(mocks.execute.mock.calls[0][0] as never)
      .sql.toLowerCase()
    expect(listSql).toContain('un.created_at >=')
    expect(listSql).toContain('un.created_at <')
    expect(listSql).toContain('cc.last_message_at >=')
    expect(listSql).toContain('cc.last_message_at <')
  })
})
