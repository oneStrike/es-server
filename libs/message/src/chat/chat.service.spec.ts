import type { DrizzleService } from '@db/core'
import { MessageChatService } from './chat.service'

function createChatDrizzleStub() {
  const afterSeqMessages = [
    {
      id: 101n,
      conversationId: 7,
      messageSeq: 11n,
      senderId: 2,
      clientMessageId: null,
      messageType: 1,
      content: 'a',
      bodyTokens: null,
      payload: null,
      status: 1,
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      editedAt: null,
      revokedAt: null,
    },
    {
      id: 102n,
      conversationId: 7,
      messageSeq: 12n,
      senderId: 2,
      clientMessageId: null,
      messageType: 1,
      content: 'b',
      bodyTokens: null,
      payload: null,
      status: 1,
      createdAt: new Date('2026-04-18T00:00:01.000Z'),
      editedAt: null,
      revokedAt: null,
    },
  ]

  const selectBuilder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(afterSeqMessages),
  }

  return {
    drizzle: {
      db: {
        select: jest.fn().mockReturnValue(selectBuilder),
        query: {
          chatConversationMember: {
            findFirst: jest.fn().mockResolvedValue({
              leftAt: null,
            }),
          },
        },
      },
    } as unknown as DrizzleService,
    selectBuilder,
  }
}

describe('MessageChatService', () => {
  it('uses limit+1 semantics to avoid false hasMore on exact page size', async () => {
    const { drizzle, selectBuilder } = createChatDrizzleStub()
    const service = new MessageChatService(
      drizzle,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        recordResyncTriggered: jest.fn().mockResolvedValue(undefined),
        recordResyncSuccess: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {} as never,
    )

    const result = await service.getConversationMessages(1, {
      conversationId: 7,
      afterSeq: '10',
      limit: 2,
    } as never)

    expect(selectBuilder.limit).toHaveBeenCalledWith(3)
    expect(result.hasMore).toBe(false)
    expect(result.list).toHaveLength(2)
  })
})
