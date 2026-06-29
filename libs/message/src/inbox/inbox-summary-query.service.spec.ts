/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import {
  chatConversation,
  chatConversationMember,
  chatMessage,
  userNotification,
} from '@db/schema'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { MessageInboxSummaryQueryService } from './inbox-summary-query.service'

const dialect = new PgDialect()

interface PreparedSelectCapture {
  selection?: Record<string, unknown>
  joins: Array<{ condition: unknown }>
  where?: unknown
  orderBy: unknown[]
  groupBy: unknown[]
  limit?: unknown
  name?: string
  execute: jest.Mock
}

interface PreparedRelationalCapture {
  config?: {
    where?: Record<string, unknown>
    columns?: Record<string, unknown>
  }
  name?: string
  execute: jest.Mock
}

function compileSql(fragment: unknown) {
  return dialect.sqlToQuery(fragment as never).sql
}

function createSelectMock(prepared: PreparedSelectCapture[]) {
  return jest.fn((selection?: Record<string, unknown>) => {
    const capture: PreparedSelectCapture = {
      selection,
      joins: [],
      orderBy: [],
      groupBy: [],
      execute: jest.fn(),
    }
    prepared.push(capture)
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
    builder.groupBy = jest.fn((...groupBy: unknown[]) => {
      capture.groupBy = groupBy
      return builder
    })
    builder.orderBy = jest.fn((...orderBy: unknown[]) => {
      capture.orderBy = orderBy
      return builder
    })
    builder.limit = jest.fn((limit: unknown) => {
      capture.limit = limit
      return builder
    })
    builder.prepare = jest.fn((name: string) => {
      capture.name = name
      return { execute: capture.execute }
    })

    return builder
  })
}

function createFindFirstMock(prepared: PreparedRelationalCapture) {
  return jest.fn((config: PreparedRelationalCapture['config']) => {
    prepared.config = config
    return {
      prepare: jest.fn((name: string) => {
        prepared.name = name
        return { execute: prepared.execute }
      }),
    }
  })
}

function createService() {
  const prepared: PreparedSelectCapture[] = []
  const preparedRelational: PreparedRelationalCapture = {
    execute: jest.fn(),
  }
  const drizzle = {
    db: {
      select: createSelectMock(prepared),
      query: {
        chatMessage: {
          findFirst: createFindFirstMock(preparedRelational),
        },
      },
    },
    schema: {
      chatConversation,
      chatConversationMember,
      chatMessage,
      userNotification,
    },
  } as unknown as DrizzleService

  return {
    service: new MessageInboxSummaryQueryService(drizzle),
    prepared,
    preparedRelational,
  }
}

describe('MessageInboxSummaryQueryService', () => {
  it('prepares notification unread summary with unread visible unexpired filters', async () => {
    const { service, prepared } = createService()
    const now = new Date('2026-03-07T12:00:00.000Z')

    await service.getNotificationUnreadSummary({ userId: 7, now })
    const query = prepared[0]

    expect(query.name).toBe('message_inbox_notification_unread_summary')
    expect(compileSql(query.where)).toContain(
      '"user_notification"."receiver_user_id" = $',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."is_hidden" = $',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."expires_at" is null',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."expires_at" > $',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."is_read" = $',
    )
    expect(query.selection?.categoryKey).toBe(userNotification.categoryKey)
    expect(query.selection?.count).toBeDefined()
    expect(query.groupBy[0]).toBe(userNotification.categoryKey)
    expect(query.execute).toHaveBeenCalledWith({ userId: 7, now })
  })

  it('prepares chat unread aggregate for active visible members', async () => {
    const { service, prepared } = createService()

    await service.getChatUnreadAggregate({ userId: 7 })
    const query = prepared[1]

    expect(query.name).toBe('message_inbox_chat_unread_aggregate')
    expect(compileSql(query.where)).toContain(
      '"chat_conversation_member"."user_id" = $',
    )
    expect(compileSql(query.where)).toContain(
      '"chat_conversation_member"."left_at" is null',
    )
    expect(compileSql(query.where)).toContain(
      '"chat_conversation_member"."hidden_at" is null',
    )
    expect(compileSql(query.selection?.unreadCount)).toContain(
      'coalesce(sum("chat_conversation_member"."unread_count"), 0)',
    )
    expect(query.execute).toHaveBeenCalledWith({ userId: 7 })
  })

  it('prepares latest notification with visibility filters and stable ordering', async () => {
    const { service, prepared } = createService()
    const now = new Date('2026-03-07T12:00:00.000Z')

    await service.getLatestNotification({ userId: 7, now })
    const query = prepared[2]

    expect(query.name).toBe('message_inbox_latest_notification')
    expect(compileSql(query.where)).toContain(
      '"user_notification"."receiver_user_id" = $',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."is_hidden" = $',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."expires_at" is null',
    )
    expect(compileSql(query.where)).toContain(
      '"user_notification"."expires_at" > $',
    )
    expect(compileSql(query.orderBy[0])).toContain(
      '"user_notification"."created_at" desc',
    )
    expect(compileSql(query.orderBy[1])).toContain(
      '"user_notification"."id" desc',
    )
    expect(query.limit).toBe(1)
    expect(query.execute).toHaveBeenCalledWith({ userId: 7, now })
  })

  it('prepares latest conversation for active member with stable ordering', async () => {
    const { service, prepared } = createService()

    await service.getLatestConversation({ userId: 7 })
    const query = prepared[3]

    expect(query.name).toBe('message_inbox_latest_conversation')
    expect(compileSql(query.joins[0].condition)).toContain(
      '"chat_conversation_member"."conversation_id" = "chat_conversation"."id"',
    )
    expect(compileSql(query.joins[0].condition)).toContain(
      '"chat_conversation_member"."user_id" = $',
    )
    expect(compileSql(query.joins[0].condition)).toContain(
      '"chat_conversation_member"."left_at" is null',
    )
    expect(compileSql(query.joins[0].condition)).toContain(
      '"chat_conversation_member"."hidden_at" is null',
    )
    expect(compileSql(query.where)).toContain(
      '"chat_conversation"."last_message_at" is not null',
    )
    expect(compileSql(query.orderBy[0])).toContain(
      '"chat_conversation"."last_message_at" desc',
    )
    expect(compileSql(query.orderBy[1])).toContain(
      '"chat_conversation"."id" desc',
    )
    expect(query.limit).toBe(1)
    expect(query.execute).toHaveBeenCalledWith({ userId: 7 })
  })

  it('prepares latest chat message content lookup by message id', async () => {
    const { service, preparedRelational } = createService()

    await service.getLatestChatMessage({ messageId: 17n })

    expect(preparedRelational.name).toBe('message_inbox_latest_chat_message')
    expect(preparedRelational.config).toMatchObject({
      columns: { content: true },
      where: {
        id: expect.objectContaining({ name: 'messageId' }),
      },
    })
    expect(preparedRelational.execute).toHaveBeenCalledWith({ messageId: 17n })
  })
})
