/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import {
  chatConversation,
  chatConversationMember,
  userNotification,
} from '@db/schema'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { MessageInboxSummaryQueryService } from './inbox-summary-query.service'

const dialect = new PgDialect()

interface PreparedSelectCapture {
  name?: string
  joins: Array<{ condition: unknown }>
  where?: unknown
  orderBy: unknown[]
  execute: jest.Mock
}

interface RelationalPreparedCapture {
  name?: string
  config?: {
    where?: Record<string, unknown>
    columns?: Record<string, boolean>
  }
  execute: jest.Mock
}

function compileSql(fragment: unknown) {
  return dialect.sqlToQuery(fragment as never).sql
}

function createSelectMock(prepared: PreparedSelectCapture[]) {
  return jest.fn(() => {
    const capture: PreparedSelectCapture = {
      joins: [],
      orderBy: [],
      execute: jest.fn(),
    }
    const builder: Record<string, jest.Mock> = {}

    builder.from = jest.fn(() => builder)
    builder.innerJoin = jest.fn((_table: unknown, condition: unknown) => {
      capture.joins.push({ condition })
      return builder
    })
    builder.where = jest.fn((condition: unknown) => {
      capture.where = condition
      return builder
    })
    builder.orderBy = jest.fn((...orderBy: unknown[]) => {
      capture.orderBy = orderBy
      return builder
    })
    builder.groupBy = jest.fn(() => builder)
    builder.limit = jest.fn(() => builder)
    builder.prepare = jest.fn((name: string) => {
      capture.name = name
      prepared.push(capture)
      return { execute: capture.execute }
    })

    return builder
  })
}

function createService() {
  const prepared: PreparedSelectCapture[] = []
  const latestChatMessageQuery: RelationalPreparedCapture = {
    execute: jest.fn(),
  }
  const drizzle = {
    db: {
      select: createSelectMock(prepared),
      query: {
        chatMessage: {
          findFirst: jest.fn((config: RelationalPreparedCapture['config']) => ({
            prepare: jest.fn((name: string) => {
              latestChatMessageQuery.name = name
              latestChatMessageQuery.config = config
              return { execute: latestChatMessageQuery.execute }
            }),
          })),
        },
      },
    },
    schema: {
      chatConversation,
      chatConversationMember,
      userNotification,
    },
  } as unknown as DrizzleService

  return {
    service: new MessageInboxSummaryQueryService(drizzle),
    prepared,
    latestChatMessageQuery,
  }
}

describe('MessageInboxSummaryQueryService', () => {
  it('builds notification and chat summary prepared queries', () => {
    const { service, prepared } = createService()
    const now = new Date('2026-04-20T00:00:00.000Z')
    const unreadSummaryQuery = prepared[0]
    const chatUnreadQuery = prepared[1]
    const latestNotificationQuery = prepared[2]

    service.getNotificationUnreadSummary({ userId: 1001, now })
    service.getChatUnreadAggregate({ userId: 1001 })
    service.getLatestNotification({ userId: 1001, now })

    expect(unreadSummaryQuery.name).toBe(
      'message_inbox_notification_unread_summary',
    )
    expect(compileSql(unreadSummaryQuery.where)).toContain(
      '"user_notification"."receiver_user_id" = $1',
    )
    expect(compileSql(unreadSummaryQuery.where)).toContain(
      '"user_notification"."is_read" = $3',
    )
    expect(unreadSummaryQuery.execute).toHaveBeenCalledWith({
      userId: 1001,
      now,
    })
    expect(chatUnreadQuery.name).toBe('message_inbox_chat_unread_aggregate')
    expect(compileSql(chatUnreadQuery.where)).toContain(
      '"chat_conversation_member"."left_at" is null',
    )
    expect(chatUnreadQuery.execute).toHaveBeenCalledWith({
      userId: 1001,
    })
    expect(latestNotificationQuery.name).toBe(
      'message_inbox_latest_notification',
    )
    expect(compileSql(latestNotificationQuery.where)).toContain(
      '"user_notification"."expires_at" > $2',
    )
    expect(compileSql(latestNotificationQuery.orderBy[0])).toContain(
      '"user_notification"."created_at" desc',
    )
    expect(latestNotificationQuery.execute).toHaveBeenCalledWith({
      userId: 1001,
      now,
    })
  })

  it('builds latest conversation and latest chat message prepared queries', () => {
    const { service, prepared, latestChatMessageQuery } = createService()
    const latestConversationQuery = prepared[3]

    service.getLatestConversation({ userId: 1001 })
    service.getLatestChatMessage({ messageId: 300n })

    expect(latestConversationQuery.name).toBe(
      'message_inbox_latest_conversation',
    )
    expect(compileSql(latestConversationQuery.joins[0].condition)).toContain(
      '"chat_conversation_member"."user_id" = $1',
    )
    expect(compileSql(latestConversationQuery.where)).toContain(
      '"chat_conversation"."last_message_at" is not null',
    )
    expect(compileSql(latestConversationQuery.orderBy[0])).toContain(
      '"chat_conversation"."last_message_at" desc',
    )
    expect(latestConversationQuery.execute).toHaveBeenCalledWith({
      userId: 1001,
    })
    expect(latestChatMessageQuery.name).toBe(
      'message_inbox_latest_chat_message',
    )
    expect(latestChatMessageQuery.config?.columns).toEqual({ content: true })
    expect(latestChatMessageQuery.config?.where).toHaveProperty('id')
    expect(latestChatMessageQuery.execute).toHaveBeenCalledWith({
      messageId: 300n,
    })
  })
})
