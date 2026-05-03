import type { DrizzleService } from '@db/core'
import type { ChatMessageSelect } from '@db/schema'
import type { EmojiCatalogService } from '@libs/interaction/emoji/emoji-catalog.service'
import type { EmojiParserService } from '@libs/interaction/emoji/emoji-parser.service'
import { EmojiSceneEnum } from '@libs/interaction/emoji/emoji.constant'
import type { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import type { MessageDomainEventPublisher } from '../eventing/message-domain-event.publisher'
import type { MessageInboxService } from '../inbox/inbox.service'
import type { MessageWsMonitorService } from '../monitor/ws-monitor.service'
import type { MessageNotificationRealtimeService } from '../notification/notification-realtime.service'
import type { MessageChatReadQueryService } from './chat-read-query.service'
import { BadRequestException } from '@nestjs/common'
import { ChatMessageStatusEnum, ChatMessageTypeEnum } from './chat.constant'
import { MessageChatService } from './chat.service'

type ChatReadQueryMock = jest.Mocked<
  Pick<
    MessageChatReadQueryService,
    | 'getConversationList'
    | 'getConversationMessages'
    | 'getConversationMessagesBefore'
    | 'getConversationMessagesAfter'
  >
>

function asDependency<T>(value: unknown = {}) {
  return value as T
}

function createMessage(overrides: Partial<ChatMessageSelect> = {}) {
  const now = new Date('2026-04-20T00:00:00.000Z')

  return {
    id: 100n,
    conversationId: 10,
    messageSeq: 1n,
    senderId: 2,
    clientMessageId: null,
    messageType: ChatMessageTypeEnum.TEXT,
    content: 'hello',
    bodyTokens: null,
    payload: null,
    status: ChatMessageStatusEnum.NORMAL,
    createdAt: now,
    editedAt: null,
    revokedAt: null,
    ...overrides,
  } satisfies ChatMessageSelect
}

function createService() {
  const findConversationMember = jest.fn().mockResolvedValue({
    leftAt: null,
  })
  const txChatConversationMemberFindFirst = jest.fn().mockResolvedValue({
    conversationId: 10,
    leftAt: null,
    lastReadMessageId: null,
  })
  const txChatConversationFindFirst = jest.fn().mockResolvedValue({ id: 10 })
  const chatMessageFindFirst = jest.fn()
  const chatConversationMemberFindMany = jest.fn().mockResolvedValue([])
  const txExecute = jest.fn().mockResolvedValue(undefined)
  const insertReturning = jest.fn()
  const insertValues = jest.fn(() => ({
    returning: insertReturning,
  }))
  const insert = jest.fn(() => ({
    values: insertValues,
  }))
  const updateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
  const updateSet = jest.fn(() => ({
    where: updateWhere,
  }))
  const update = jest.fn(() => ({
    set: updateSet,
  }))
  const count = jest.fn().mockResolvedValue(0)
  const tx = {
    query: {
      chatConversationMember: {
        findFirst: txChatConversationMemberFindFirst,
        findMany: chatConversationMemberFindMany,
      },
      chatConversation: {
        findFirst: txChatConversationFindFirst,
      },
      chatMessage: {
        findFirst: chatMessageFindFirst,
      },
    },
    execute: txExecute,
    insert,
    update,
    $count: count,
  }
  const transaction = jest.fn(
    async (callback: (transactionClient: typeof tx) => unknown) => callback(tx),
  )
  const drizzle = {
    db: {
      query: {
        chatConversationMember: {
          findFirst: findConversationMember,
          findMany: chatConversationMemberFindMany,
        },
        chatConversation: {
          findFirst: txChatConversationFindFirst,
        },
        chatMessage: {
          findFirst: chatMessageFindFirst,
        },
      },
      transaction,
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
    assertAffectedRows: jest.fn(),
    isUniqueViolation: jest.fn().mockReturnValue(false),
  } as unknown as DrizzleService
  const emojiParserService = {
    parse: jest.fn().mockResolvedValue([]),
  }
  const emojiCatalogService = {
    recordRecentUsageInTx: jest.fn().mockResolvedValue(undefined),
  }
  const messageNotificationRealtimeService = {
    emitChatConversationUpdate: jest.fn(),
    emitChatMessageNew: jest.fn(),
    emitInboxSummaryUpdated: jest.fn(),
  }
  const messageInboxService = {
    getSummary: jest.fn().mockResolvedValue({ unreadCount: 0 }),
  }
  const wsMonitorService = {
    recordResyncTriggered: jest.fn().mockResolvedValue(undefined),
    recordResyncSuccess: jest.fn().mockResolvedValue(undefined),
  }
  const messageDomainEventPublisher = {
    publishInTx: jest.fn().mockResolvedValue({
      event: { id: 501n },
    }),
  }
  const domainEventDispatchService = {
    claimPendingDispatchByEvent: jest.fn().mockResolvedValue(null),
    markDispatchSucceeded: jest.fn().mockResolvedValue(undefined),
    markDispatchFailed: jest.fn().mockResolvedValue(undefined),
  }
  const chatReadQueryService: ChatReadQueryMock = {
    getConversationList: jest.fn(),
    getConversationMessages: jest.fn().mockResolvedValue([]),
    getConversationMessagesBefore: jest.fn().mockResolvedValue([]),
    getConversationMessagesAfter: jest.fn().mockResolvedValue([]),
  }

  return {
    service: new MessageChatService(
      drizzle,
      asDependency<EmojiParserService>(emojiParserService),
      asDependency<EmojiCatalogService>(emojiCatalogService),
      asDependency<MessageNotificationRealtimeService>(
        messageNotificationRealtimeService,
      ),
      asDependency<MessageInboxService>(messageInboxService),
      asDependency<MessageWsMonitorService>(wsMonitorService),
      asDependency<MessageDomainEventPublisher>(messageDomainEventPublisher),
      asDependency<DomainEventDispatchService>(domainEventDispatchService),
      asDependency<MessageChatReadQueryService>(chatReadQueryService),
    ),
    mocks: {
      findConversationMember,
      chatReadQueryService,
      wsMonitorService,
      drizzle,
      tx,
      transaction,
      txChatConversationMemberFindFirst,
      txChatConversationFindFirst,
      chatMessageFindFirst,
      chatConversationMemberFindMany,
      txExecute,
      insert,
      insertValues,
      insertReturning,
      update,
      updateSet,
      updateWhere,
      count,
      emojiParserService,
      emojiCatalogService,
      messageNotificationRealtimeService,
      messageInboxService,
      messageDomainEventPublisher,
      domainEventDispatchService,
    },
  }
}

describe('chat.service prepared read queries', () => {
  it('uses the initial prepared message query when no cursor is provided', async () => {
    const { service, mocks } = createService()
    mocks.chatReadQueryService.getConversationMessages.mockResolvedValue([
      createMessage({ id: 101n, messageSeq: 3n }),
      createMessage({ id: 100n, messageSeq: 2n }),
    ])

    const result = await service.getConversationMessages(7, {
      conversationId: 10,
      limit: 1,
    })

    expect(mocks.findConversationMember).toHaveBeenCalledWith({
      where: {
        conversationId: 10,
        userId: 7,
      },
      columns: {
        leftAt: true,
      },
    })
    expect(
      mocks.chatReadQueryService.getConversationMessages,
    ).toHaveBeenCalledWith({
      conversationId: 10,
      limit: 2,
    })
    expect(
      mocks.chatReadQueryService.getConversationMessagesBefore,
    ).not.toHaveBeenCalled()
    expect(
      mocks.chatReadQueryService.getConversationMessagesAfter,
    ).not.toHaveBeenCalled()
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe('3')
    expect(result.list).toHaveLength(1)
    expect(result.list[0]).toMatchObject({
      id: '101',
      conversationId: 10,
      messageSeq: '3',
      content: 'hello',
    })
  })

  it('uses the before-cursor prepared query for history pagination', async () => {
    const { service, mocks } = createService()
    mocks.chatReadQueryService.getConversationMessagesBefore.mockResolvedValue([
      createMessage({ id: 102n, messageSeq: 8n }),
    ])

    const result = await service.getConversationMessages(7, {
      conversationId: 10,
      cursor: '9',
      limit: 20,
    })

    expect(
      mocks.chatReadQueryService.getConversationMessagesBefore,
    ).toHaveBeenCalledWith({
      conversationId: 10,
      cursor: 9n,
      limit: 21,
    })
    expect(
      mocks.chatReadQueryService.getConversationMessages,
    ).not.toHaveBeenCalled()
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBe('8')
  })

  it('uses the after-seq prepared query for resync pagination', async () => {
    const { service, mocks } = createService()
    mocks.chatReadQueryService.getConversationMessagesAfter.mockResolvedValue([
      createMessage({ id: 103n, messageSeq: 11n }),
    ])

    const result = await service.getConversationMessages(7, {
      conversationId: 10,
      afterSeq: '10',
      limit: 20,
    })

    expect(
      mocks.chatReadQueryService.getConversationMessagesAfter,
    ).toHaveBeenCalledWith({
      conversationId: 10,
      afterSeq: 10n,
      limit: 21,
    })
    expect(mocks.wsMonitorService.recordResyncTriggered).toHaveBeenCalled()
    expect(mocks.wsMonitorService.recordResyncSuccess).toHaveBeenCalled()
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBe('11')
  })
})

describe('chat.service send boundary', () => {
  it.each([
    ['blank content', { content: '   ' }],
    ['content length 5001', { content: 'a'.repeat(5001) }],
    ['invalid JSON payload', { payload: '{bad' }],
    ['JSON array payload', { payload: '[]' }],
    ['JSON null payload', { payload: 'null' }],
    [
      'payload deeper than 6 levels',
      {
        payload: JSON.stringify({
          a: { b: { c: { d: { e: { f: { g: true } } } } } },
        }),
      },
    ],
    [
      'payload larger than 16 KiB',
      { payload: JSON.stringify({ text: '好'.repeat(6000) }) },
    ],
  ])(
    'rejects %s before emoji parsing and database transaction',
    async (_label, dto) => {
      const { service, mocks } = createService()

      await expect(
        service.sendMessage(7, {
          conversationId: 10,
          messageType: ChatMessageTypeEnum.TEXT,
          content: 'hello',
          ...dto,
        }),
      ).rejects.toThrow(BadRequestException)
      expect(mocks.emojiParserService.parse).not.toHaveBeenCalled()
      expect(mocks.transaction).not.toHaveBeenCalled()
    },
  )

  it('accepts content length 5000 and clientMessageId length 64', async () => {
    const { service, mocks } = createService()
    jest
      .spyOn(
        service as unknown as {
          createMessageWithRetry: MessageChatService['sendMessage']
        },
        'createMessageWithRetry',
      )
      .mockResolvedValue({
        message: createMessage({
          id: 200n,
          conversationId: 10,
          messageSeq: 6n,
          senderId: 7,
          clientMessageId: 'b'.repeat(64),
          content: 'a'.repeat(5000),
        }),
        isNew: false,
      } as never)

    const result = await service.sendMessage(7, {
      conversationId: 10,
      messageType: ChatMessageTypeEnum.TEXT,
      content: 'a'.repeat(5000),
      clientMessageId: 'b'.repeat(64),
    })

    expect(result).toMatchObject({
      id: '200',
      messageSeq: '6',
      deduplicated: true,
    })
    expect(mocks.emojiParserService.parse).toHaveBeenCalledWith({
      body: 'a'.repeat(5000),
      scene: EmojiSceneEnum.CHAT,
    })
  })
})

describe('chat.service write path', () => {
  it('returns an existing clientMessageId message without inserting or dispatching', async () => {
    const { service, mocks } = createService()
    mocks.chatMessageFindFirst.mockResolvedValueOnce(
      createMessage({
        id: 201n,
        senderId: 7,
        clientMessageId: 'client-1',
      }),
    )

    const result = await service.sendMessage(7, {
      conversationId: 10,
      messageType: ChatMessageTypeEnum.TEXT,
      content: 'hello',
      clientMessageId: 'client-1',
    })

    expect(result).toMatchObject({
      id: '201',
      messageId: '201',
      deduplicated: true,
    })
    expect(mocks.txExecute).toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.messageDomainEventPublisher.publishInTx).not.toHaveBeenCalled()
    expect(
      mocks.domainEventDispatchService.claimPendingDispatchByEvent,
    ).not.toHaveBeenCalled()
  })

  it('inserts a new message, updates conversation state, increments unread members, and publishes the domain event', async () => {
    const { service, mocks } = createService()
    const insertedMessage = createMessage({
      id: 202n,
      conversationId: 10,
      messageSeq: 6n,
      senderId: 7,
      clientMessageId: 'client-2',
      payload: { extra: true, clientMessageId: 'client-2' },
    })
    mocks.chatMessageFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ messageSeq: 5n })
    mocks.insertReturning.mockResolvedValue([insertedMessage])

    const result = await service.sendMessage(7, {
      conversationId: 10,
      messageType: ChatMessageTypeEnum.TEXT,
      content: 'hello',
      clientMessageId: 'client-2',
      payload: JSON.stringify({ extra: true }),
    })

    expect(result).toMatchObject({
      id: '202',
      messageSeq: '6',
      deduplicated: false,
    })
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 10,
        messageSeq: 6n,
        senderId: 7,
        clientMessageId: 'client-2',
        payload: { extra: true, clientMessageId: 'client-2' },
      }),
    )
    expect(mocks.update).toHaveBeenCalledTimes(2)
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastMessageId: 202n,
        lastSenderId: 7,
      }),
    )
    expect(mocks.messageDomainEventPublisher.publishInTx).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        eventKey: 'chat.message.created',
        subjectId: 7,
        targetId: 10,
        context: {
          conversationId: 10,
          messageId: '202',
        },
      }),
    )
    expect(
      mocks.domainEventDispatchService.claimPendingDispatchByEvent,
    ).toHaveBeenCalledWith(501n, 'chat_realtime')
  })

  it('falls back to an existing idempotent message after a unique conflict', async () => {
    const { service, mocks } = createService()
    const conflict = new Error('duplicate clientMessageId')
    mocks.transaction.mockRejectedValueOnce(conflict)
    ;(mocks.drizzle.isUniqueViolation as jest.Mock).mockReturnValue(true)
    mocks.chatMessageFindFirst.mockResolvedValueOnce(
      createMessage({
        id: 203n,
        senderId: 7,
        clientMessageId: 'client-3',
      }),
    )

    const result = await service.sendMessage(7, {
      conversationId: 10,
      messageType: ChatMessageTypeEnum.TEXT,
      content: 'hello',
      clientMessageId: 'client-3',
    })

    expect(result).toMatchObject({
      id: '203',
      deduplicated: true,
    })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })

  it('retries unique conflicts without clientMessageId and surfaces the last error', async () => {
    const { service, mocks } = createService()
    const conflict = new Error('duplicate seq')
    mocks.transaction.mockRejectedValue(conflict)
    ;(mocks.drizzle.isUniqueViolation as jest.Mock).mockReturnValue(true)

    await expect(
      service.sendMessage(7, {
        conversationId: 10,
        messageType: ChatMessageTypeEnum.TEXT,
        content: 'hello',
      }),
    ).rejects.toThrow(conflict)
    expect(mocks.transaction).toHaveBeenCalledTimes(3)
  })
})

describe('chat.service mark read write path', () => {
  it('preserves a newer previous read position and recalculates unread count', async () => {
    const { service, mocks } = createService()
    const readAt = new Date('2026-05-03T08:00:00.000Z')
    jest.useFakeTimers().setSystemTime(readAt)
    mocks.txChatConversationMemberFindFirst.mockResolvedValue({
      conversationId: 10,
      leftAt: null,
      lastReadMessageId: 90n,
    })
    mocks.chatMessageFindFirst
      .mockResolvedValueOnce({ id: 80n, messageSeq: 2n })
      .mockResolvedValueOnce({ id: 90n, messageSeq: 5n })
    mocks.count.mockResolvedValue(3)

    try {
      const result = await service.markConversationRead(7, {
        conversationId: 10,
        messageId: '80',
      })

      expect(mocks.updateSet).toHaveBeenCalledWith({
        lastReadMessageId: 90n,
        lastReadAt: readAt,
        unreadCount: 3,
      })
      expect(
        mocks.messageNotificationRealtimeService.emitChatConversationUpdate,
      ).toHaveBeenCalledWith(7, {
        conversationId: 10,
        unreadCount: 3,
        lastReadAt: readAt,
        lastReadMessageId: '90',
      })
      expect(mocks.messageInboxService.getSummary).toHaveBeenCalledWith(7)
      expect(result).toEqual({
        conversationId: 10,
        messageId: '90',
        readUptoMessageId: '90',
      })
    } finally {
      jest.useRealTimers()
    }
  })
})
