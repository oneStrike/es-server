import { ChatRealtimeEventConsumer } from './chat-realtime-event.consumer'

describe('ChatRealtimeEventConsumer', () => {
  it('chat.message.created 会转给 MessageChatService 处理', async () => {
    const dispatchMessageCreatedDomainEvent = jest.fn().mockResolvedValue(undefined)
    const moduleRef = {
      get: jest.fn().mockReturnValue({
        dispatchMessageCreatedDomainEvent,
      }),
    }

    const service = new ChatRealtimeEventConsumer(moduleRef as any)

    await service.consume(
      {
        id: 11n,
        eventKey: 'chat.message.created',
        domain: 'message',
        subjectType: 'user',
        subjectId: 9,
        targetType: 'chat_conversation',
        targetId: 7,
        operatorId: 9,
        occurredAt: new Date('2026-04-13T00:00:00.000Z'),
        context: {
          conversationId: 7,
          messageId: '101',
        },
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
      },
      {
        id: 21n,
        eventId: 11n,
        consumer: 'chat_realtime',
        status: 'processing',
        retryCount: 0,
        nextRetryAt: null,
        lastError: null,
        processedAt: null,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    )

    expect(dispatchMessageCreatedDomainEvent).toHaveBeenCalledTimes(1)
  })
})
