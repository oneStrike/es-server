import { MessageOutboxDomainEnum } from '../outbox/outbox.constant'
import { ChatMessageTypeEnum } from './chat.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('@libs/interaction/emoji', () => ({
  EmojiCatalogService: class {},
  EmojiParserService: class {},
  EmojiSceneEnum: {
    CHAT: 'CHAT',
  },
}))

describe('message chat service outbox flow', () => {
  async function createService() {
    const createdAt = new Date('2026-03-29T15:00:00.000Z')
    const insertedMessage = {
      id: 5001n,
      conversationId: 9,
      messageSeq: 8n,
      senderId: 1001,
      clientMessageId: 'client-1',
      messageType: ChatMessageTypeEnum.TEXT,
      content: 'hello world',
      bodyTokens: null,
      payload: { foo: 'bar' },
      status: 1,
      createdAt,
      editedAt: null,
      revokedAt: null,
    }

    const chatConversationMemberFindFirst = jest
      .fn()
      .mockResolvedValue({ conversationId: 9, leftAt: null })
    const chatConversationFindFirst = jest
      .fn()
      .mockResolvedValue({ id: 9 })
    const chatMessageFindFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ messageSeq: 7n })
    const execute = jest.fn().mockResolvedValue(undefined)
    const returning = jest.fn().mockResolvedValue([insertedMessage])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))

    const updateConversationWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
    const updateConversationSet = jest.fn(() => ({ where: updateConversationWhere }))
    const updateConversation = jest.fn(() => ({ set: updateConversationSet }))

    const updateUnreadWhere = jest.fn().mockResolvedValue({ rowCount: 2 })
    const updateUnreadSet = jest.fn(() => ({ where: updateUnreadWhere }))
    const updateUnread = jest.fn(() => ({ set: updateUnreadSet }))

    const update = jest
      .fn()
      .mockImplementationOnce(updateConversation)
      .mockImplementationOnce(updateUnread)

    const transaction = jest.fn(async (callback) =>
      callback({
        query: {
          chatConversationMember: {
            findFirst: chatConversationMemberFindFirst,
          },
          chatConversation: {
            findFirst: chatConversationFindFirst,
          },
          chatMessage: {
            findFirst: chatMessageFindFirst,
          },
        },
        execute,
        insert,
        update,
      } as any),
    )

    const assertAffectedRows = jest.fn()
    const emojiParse = jest.fn().mockResolvedValue([])
    const recordRecentUsageInTx = jest.fn().mockResolvedValue(undefined)
    const emitChatConversationUpdate = jest.fn()
    const emitChatMessageNew = jest.fn()
    const emitInboxSummaryUpdate = jest.fn()
    const enqueueChatMessageCreatedEventInTx = jest
      .fn()
      .mockResolvedValue(undefined)
    const markEventSucceededByBizKey = jest
      .fn()
      .mockResolvedValue(true)

    const { MessageChatService } = await import('./chat.service')

    const service = new MessageChatService(
      {
        db: { transaction },
        assertAffectedRows,
        isUniqueViolation: jest.fn().mockReturnValue(false),
      } as any,
      {
        parse: emojiParse,
      } as any,
      {
        recordRecentUsageInTx,
      } as any,
      {
        emitChatConversationUpdate,
        emitChatMessageNew,
        emitInboxSummaryUpdate,
      } as any,
      {
        getSummary: jest.fn(),
      } as any,
      {} as any,
      {
        enqueueChatMessageCreatedEventInTx,
        markEventSucceededByBizKey,
      } as any,
    )

    return {
      service,
      createdAt,
      insertedMessage,
      mocks: {
        emojiParse,
        recordRecentUsageInTx,
        emitChatConversationUpdate,
        emitChatMessageNew,
        emitInboxSummaryUpdate,
        enqueueChatMessageCreatedEventInTx,
        markEventSucceededByBizKey,
        assertAffectedRows,
      },
    }
  }

  it('enqueues chat outbox event and dispatches it immediately after message commit', async () => {
    const { service, createdAt, mocks } = await createService()
    const dispatchSpy = jest
      .spyOn(service, 'dispatchMessageCreatedOutboxEvent')
      .mockResolvedValue(undefined)

    await expect(
      service.sendMessage(1001, {
        conversationId: 9,
        messageType: ChatMessageTypeEnum.TEXT,
        content: 'hello world',
        clientMessageId: 'client-1',
        payload: '{"foo":"bar"}',
      }),
    ).resolves.toEqual({
      id: '5001',
      conversationId: 9,
      messageId: '5001',
      messageSeq: '8',
      createdAt,
      deduplicated: false,
    })

    expect(mocks.enqueueChatMessageCreatedEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      {
        bizKey: 'chat:message:created:5001',
        eventType: 1,
        payload: {
          conversationId: 9,
          messageId: '5001',
        },
      },
    )
    expect(dispatchSpy).toHaveBeenCalledWith({
      conversationId: 9,
      messageId: '5001',
    })
    expect(mocks.markEventSucceededByBizKey).toHaveBeenCalledWith({
      bizKey: 'chat:message:created:5001',
      domain: MessageOutboxDomainEnum.CHAT,
    })
    expect(mocks.emitChatConversationUpdate).not.toHaveBeenCalled()
    expect(mocks.emitChatMessageNew).not.toHaveBeenCalled()
    expect(mocks.emitInboxSummaryUpdate).not.toHaveBeenCalled()
  })

  it('keeps the message committed when immediate outbox dispatch fails', async () => {
    const { service, createdAt, mocks } = await createService()
    jest
      .spyOn(service, 'dispatchMessageCreatedOutboxEvent')
      .mockRejectedValue(new Error('ws emit failed'))

    await expect(
      service.sendMessage(1001, {
        conversationId: 9,
        messageType: ChatMessageTypeEnum.TEXT,
        content: 'hello world',
        clientMessageId: 'client-1',
      }),
    ).resolves.toEqual({
      id: '5001',
      conversationId: 9,
      messageId: '5001',
      messageSeq: '8',
      createdAt,
      deduplicated: false,
    })

    expect(mocks.enqueueChatMessageCreatedEventInTx).toHaveBeenCalled()
    expect(mocks.markEventSucceededByBizKey).not.toHaveBeenCalled()
  })
})
