/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import {
  chatConversation,
  chatConversationMember,
  chatMessage,
} from '@db/schema'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { MessageChatReadQueryService } from './chat-read-query.service'

const dialect = new PgDialect()

interface PreparedSelectCapture {
  name?: string
  joins: Array<{ condition: unknown }>
  where?: unknown
  orderBy: unknown[]
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
    builder.offset = jest.fn(() => builder)
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
  const drizzle = {
    db: {
      select: createSelectMock(prepared),
    },
    schema: {
      chatConversation,
      chatConversationMember,
      chatMessage,
    },
  } as unknown as DrizzleService

  return {
    service: new MessageChatReadQueryService(drizzle),
    prepared,
  }
}

describe('MessageChatReadQueryService', () => {
  it('builds and executes the conversation list prepared query', () => {
    const { service, prepared } = createService()
    const conversationListQuery = prepared[0]

    service.getConversationList({
      userId: 7,
      offset: 20,
      limit: 10,
    })

    expect(conversationListQuery.name).toBe('message_chat_conversation_list')
    expect(compileSql(conversationListQuery.joins[0].condition)).toContain(
      '"chat_conversation_member"."user_id" = $1',
    )
    expect(compileSql(conversationListQuery.joins[0].condition)).toContain(
      '"chat_conversation_member"."left_at" is null',
    )
    expect(compileSql(conversationListQuery.orderBy[0])).toContain(
      '"chat_conversation"."last_message_at" desc nulls last',
    )
    expect(conversationListQuery.execute).toHaveBeenCalledWith({
      userId: 7,
      offset: 20,
      limit: 10,
    })
  })

  it('builds message page queries for initial, before-cursor, and after-seq reads', () => {
    const { service, prepared } = createService()
    const initialQuery = prepared[1]
    const beforeQuery = prepared[2]
    const afterQuery = prepared[3]

    service.getConversationMessages({ conversationId: 10, limit: 21 })
    service.getConversationMessagesBefore({
      conversationId: 10,
      cursor: 9n,
      limit: 21,
    })
    service.getConversationMessagesAfter({
      conversationId: 10,
      afterSeq: 10n,
      limit: 21,
    })

    expect(initialQuery.name).toBe('message_chat_messages_initial')
    expect(compileSql(initialQuery.where)).toContain(
      '"chat_message"."status" <> $2',
    )
    expect(compileSql(initialQuery.orderBy[0])).toContain(
      '"chat_message"."message_seq" desc',
    )
    expect(initialQuery.execute).toHaveBeenCalledWith({
      conversationId: 10,
      limit: 21,
    })
    expect(beforeQuery.name).toBe('message_chat_messages_before')
    expect(compileSql(beforeQuery.where)).toContain(
      '"chat_message"."message_seq" < $3',
    )
    expect(beforeQuery.execute).toHaveBeenCalledWith({
      conversationId: 10,
      cursor: 9n,
      limit: 21,
    })
    expect(afterQuery.name).toBe('message_chat_messages_after')
    expect(compileSql(afterQuery.where)).toContain(
      '"chat_message"."message_seq" > $3',
    )
    expect(afterQuery.execute).toHaveBeenCalledWith({
      conversationId: 10,
      afterSeq: 10n,
      limit: 21,
    })
  })
})
