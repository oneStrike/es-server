import type { DrizzleService } from '@db/core'
import type { SQL } from 'drizzle-orm'
import type { AdminUserService } from '../admin-user/admin-user.service'
import { appUser, chatConversation, chatConversationMember, chatMessage } from '@db/schema'
import {
  ChatMessageStatusEnum,
  ChatMessageTypeEnum,
} from '@libs/message/chat/chat.constant'
import { ForbiddenException } from '@nestjs/common'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { MessageChatInvestigationService } from './message-chat-investigation.service'

const dialect = new PgDialect()

function createQueryBuilder<T>(rows: T[]) {
  const joins: SQL[] = []
  const where: SQL[] = []
  const builder: Record<string, jest.Mock> = {}

  builder.from = jest.fn(() => builder)
  builder.innerJoin = jest.fn((_: unknown, condition: SQL) => {
    joins.push(condition)
    return builder
  })
  builder.where = jest.fn((condition: SQL) => {
    where.push(condition)
    return builder
  })
  builder.orderBy = jest.fn(() => builder)
  builder.limit = jest.fn(() => builder)
  builder.offset = jest.fn(() => Promise.resolve(rows))
  builder.then = jest.fn((resolve: (value: T[]) => unknown) =>
    Promise.resolve(rows).then(resolve),
  )

  return { builder, joins, where }
}

function createCountBuilder(total: number) {
  const joins: SQL[] = []
  const where: SQL[] = []
  const builder: Record<string, jest.Mock> = {}

  builder.from = jest.fn(() => builder)
  builder.innerJoin = jest.fn((_: unknown, condition: SQL) => {
    joins.push(condition)
    return builder
  })
  builder.where = jest.fn((condition: SQL) => {
    where.push(condition)
    return Promise.resolve([{ count: total }])
  })

  return { builder, joins, where }
}

function sqlText(value: SQL | undefined) {
  return value ? dialect.sqlToQuery(value).sql : ''
}

function createService(options: {
  messageRows?: Record<string, unknown>[]
  conversationRows?: Record<string, unknown>[]
  total?: number
} = {}) {
  const countBuilder = createCountBuilder(options.total ?? 0)
  const messageRowsBuilder = createQueryBuilder(options.messageRows ?? [])
  const conversationRowsBuilder = createQueryBuilder(options.conversationRows ?? [])
  const select = jest.fn((selection: Record<string, unknown>) => {
    const keys = Object.keys(selection)
    if (keys.includes('count')) {
      return countBuilder.builder
    }
    if (keys.includes('messageSeq')) {
      return messageRowsBuilder.builder
    }
    return conversationRowsBuilder.builder
  })
  const buildPage = jest.fn(
    (
      input: { pageIndex?: number; pageSize?: number },
      pageOptions?: { maxPageSize?: number },
    ) => {
      const pageIndex = input.pageIndex ?? 1
      const requestedPageSize = input.pageSize ?? 20
      const pageSize = Math.min(
        requestedPageSize,
        pageOptions?.maxPageSize ?? requestedPageSize,
      )

      return {
        pageIndex,
        pageSize,
        offset: (pageIndex - 1) * pageSize,
      }
    },
  )
  const drizzle = {
    db: { select },
    schema: {
      appUser,
      chatConversation,
      chatConversationMember,
      chatMessage,
    },
    buildPage,
  } as unknown as DrizzleService
  const adminUserService = {
    isSuperAdmin: jest.fn().mockResolvedValue(undefined),
  } as unknown as AdminUserService

  return {
    service: new MessageChatInvestigationService(drizzle, adminUserService),
    mocks: {
      adminUserService,
      buildPage,
      countBuilder,
      conversationRowsBuilder,
      messageRowsBuilder,
      select,
    },
  }
}

describe('MessageChatInvestigationService', () => {
  it('constrains conversation investigation to the requested active member', async () => {
    const { service, mocks } = createService()

    await service.getConversationPage(1, {
      userId: 10001,
      pageIndex: 1,
      pageSize: 200,
    })

    const joinSql = sqlText(mocks.conversationRowsBuilder.joins[0])
    expect(joinSql).toContain('"chat_conversation_member"."conversation_id"')
    expect(joinSql).toContain('"chat_conversation"."id"')
    expect(joinSql).toContain('"chat_conversation_member"."user_id"')
    expect(joinSql).toContain('"chat_conversation_member"."left_at" is null')
    expect(mocks.buildPage).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 200 }),
      { maxPageSize: 100 },
    )
    expect(mocks.conversationRowsBuilder.builder.limit).toHaveBeenCalledWith(100)
    expect(mocks.adminUserService.isSuperAdmin).toHaveBeenCalledWith(1)
  })

  it('constrains message investigation to active membership for the requested user', async () => {
    const { service, mocks } = createService()

    await service.getMessagePage(1, {
      conversationId: 12,
      userId: 10001,
      pageIndex: 1,
      pageSize: 20,
    })

    const joinSql = sqlText(mocks.messageRowsBuilder.joins[0])
    expect(joinSql).toContain('"chat_conversation_member"."conversation_id"')
    expect(joinSql).toContain('"chat_message"."conversation_id"')
    expect(joinSql).toContain('"chat_conversation_member"."user_id"')
    expect(joinSql).toContain('"chat_conversation_member"."left_at" is null')
  })

  it('caps message pages at 100 items', async () => {
    const { service, mocks } = createService()

    const page = await service.getMessagePage(1, {
      conversationId: 12,
      userId: 10001,
      pageIndex: 2,
      pageSize: 500,
    })

    expect(page.pageIndex).toBe(2)
    expect(page.pageSize).toBe(100)
    expect(mocks.messageRowsBuilder.builder.limit).toHaveBeenCalledWith(100)
    expect(mocks.messageRowsBuilder.builder.offset).toHaveBeenCalledWith(100)
  })

  it('returns only sanitized message previews and boolean payload flags', async () => {
    const rawContent = `  ${'a'.repeat(90)}\nsecret tail  `
    const { service } = createService({
      total: 1,
      messageRows: [
        {
          id: 1025n,
          conversationId: 12,
          messageSeq: 88n,
          senderId: 10002,
          messageType: ChatMessageTypeEnum.TEXT,
          status: ChatMessageStatusEnum.NORMAL,
          content: rawContent,
          hasPayload: true,
          hasBodyTokens: true,
          payload: { raw: 'must-not-leak' },
          bodyTokens: [{ type: 'text', value: 'must-not-leak' }],
          createdAt: new Date('2026-03-07T12:01:00.000Z'),
        },
      ],
    })

    const page = await service.getMessagePage(1, {
      conversationId: 12,
      userId: 10001,
      pageIndex: 1,
      pageSize: 15,
    })

    expect(page.list[0]).toEqual({
      messageId: '1025',
      conversationId: 12,
      messageSeq: '88',
      senderId: 10002,
      messageType: ChatMessageTypeEnum.TEXT,
      status: ChatMessageStatusEnum.NORMAL,
      contentPreview: `${'a'.repeat(80)}...`,
      hasPayload: true,
      hasBodyTokens: true,
      createdAt: new Date('2026-03-07T12:01:00.000Z'),
    })
    expect(page.list[0]).not.toHaveProperty('payload')
    expect(page.list[0]).not.toHaveProperty('bodyTokens')
    expect(page.list[0]).not.toHaveProperty('rawPayload')
  })

  it('accepts VXE JSON orderBy payloads for chat investigation grids', async () => {
    const { service, mocks } = createService()

    await service.getMessagePage(1, {
      conversationId: 12,
      userId: 10001,
      pageIndex: 1,
      pageSize: 20,
      orderBy: JSON.stringify([{ createdAt: 'asc' }]),
    })

    expect(mocks.messageRowsBuilder.builder.orderBy).toHaveBeenCalled()
  })

  it('rejects unsupported JSON orderBy fields', async () => {
    const { service } = createService()

    await expect(
      service.getConversationPage(1, {
        userId: 10001,
        pageIndex: 1,
        pageSize: 20,
        orderBy: JSON.stringify([{ unreadCount: 'desc' }]),
      }),
    ).rejects.toThrow('排序字段 "unreadCount" 不支持')
  })

  it('rejects non-super-admin operators before querying chat investigation data', async () => {
    const { service, mocks } = createService()
    jest
      .spyOn(mocks.adminUserService, 'isSuperAdmin')
      .mockRejectedValueOnce(new ForbiddenException('权限不足'))

    await expect(
      service.getConversationPage(2, {
        userId: 10001,
        pageIndex: 1,
        pageSize: 20,
      }),
    ).rejects.toThrow('权限不足')
    expect(mocks.select).not.toHaveBeenCalled()
  })

  it('exposes and filters hidden conversation visibility for operators', async () => {
    const hiddenAt = new Date('2026-03-07T12:02:00.000Z')
    const { service, mocks } = createService({
      total: 1,
      conversationRows: [
        {
          conversationId: 12,
          userId: 10001,
          isPinned: false,
          hiddenAt,
          unreadCount: 0,
          lastReadMessageId: 1024n,
          lastReadAt: new Date('2026-03-07T12:00:00.000Z'),
          lastMessageId: null,
          lastMessageAt: new Date('2026-03-07T12:01:00.000Z'),
          lastSenderId: 10002,
        },
      ],
    })

    const page = await service.getConversationPage(1, {
      userId: 10001,
      hiddenOnly: true,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(sqlText(mocks.conversationRowsBuilder.where[0])).toContain(
      '"chat_conversation_member"."hidden_at" is not null',
    )
    expect(page.list[0]).toMatchObject({
      conversationId: 12,
      isHiddenForUser: true,
      hiddenAt,
    })
  })
})
