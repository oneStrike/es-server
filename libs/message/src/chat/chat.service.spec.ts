import type { DrizzleService } from '@db/core'
import type { ChatMessageSelect } from '@db/schema'
import type { EmojiCatalogService } from '@libs/interaction/emoji/emoji-catalog.service'
import type { EmojiParserService } from '@libs/interaction/emoji/emoji-parser.service'
import type { DomainEventDispatchService } from '@libs/platform/modules/eventing/domain-event-dispatch.service'
import type { MessageDomainEventPublisher } from '../eventing/message-domain-event.publisher'
import type { MessageInboxService } from '../inbox/inbox.service'
import type { MessageWsMonitorService } from '../monitor/ws-monitor.service'
import type { MessageNotificationRealtimeService } from '../notification/notification-realtime.service'
import type { MessageChatReadQueryService } from './chat-read-query.service'
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
  const drizzle = {
    db: {
      query: {
        chatConversationMember: {
          findFirst: findConversationMember,
        },
      },
    },
  } as unknown as DrizzleService
  const wsMonitorService = {
    recordResyncTriggered: jest.fn().mockResolvedValue(undefined),
    recordResyncSuccess: jest.fn().mockResolvedValue(undefined),
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
      asDependency<EmojiParserService>(),
      asDependency<EmojiCatalogService>(),
      asDependency<MessageNotificationRealtimeService>(),
      asDependency<MessageInboxService>(),
      asDependency<MessageWsMonitorService>(wsMonitorService),
      asDependency<MessageDomainEventPublisher>(),
      asDependency<DomainEventDispatchService>(),
      asDependency<MessageChatReadQueryService>(chatReadQueryService),
    ),
    mocks: {
      findConversationMember,
      chatReadQueryService,
      wsMonitorService,
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
