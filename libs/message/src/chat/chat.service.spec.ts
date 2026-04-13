import { BadRequestException } from '@nestjs/common'
import { DomainEventConsumerEnum } from '@libs/platform/modules/eventing'
import { ChatMessageTypeEnum } from './chat.constant'
import { MessageChatService } from './chat.service'

describe('MessageChatService', () => {
  function createService() {
    const domainEventDispatchService = {
      claimPendingDispatchByEvent: jest.fn(),
      markDispatchSucceeded: jest.fn(),
      markDispatchFailed: jest.fn(),
    }

    const service = new MessageChatService(
      {
        db: {},
        schema: {},
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      domainEventDispatchService as never,
    )

    return {
      service,
      domainEventDispatchService,
    }
  }

  it('即时分发失败后会立刻把已 claim 的 chat dispatch 标记为失败', async () => {
    const claimedDispatch = {
      id: 21n,
      eventId: 11n,
      consumer: DomainEventConsumerEnum.CHAT_REALTIME,
      status: 'processing',
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    }
    const { service, domainEventDispatchService } = createService()
    domainEventDispatchService.claimPendingDispatchByEvent.mockResolvedValue(
      claimedDispatch,
    )
    domainEventDispatchService.markDispatchFailed.mockResolvedValue(undefined)
    jest
      .spyOn(service as any, 'dispatchMessageCreatedPayload')
      .mockRejectedValue(new Error('chat-realtime-boom'))

    await (service as any).tryDispatchMessageCreatedDomainEvent(11n, {
      conversationId: 7,
      messageId: '99',
    })

    expect(
      domainEventDispatchService.claimPendingDispatchByEvent,
    ).toHaveBeenCalledWith(11n, DomainEventConsumerEnum.CHAT_REALTIME)
    expect(domainEventDispatchService.markDispatchFailed).toHaveBeenCalledWith(
      claimedDispatch,
      expect.any(Error),
    )
  })

  it('会拒绝客户端发送 SYSTEM 类型消息', async () => {
    const { service } = createService()

    expect(() =>
      (service as any).parseMessageType(ChatMessageTypeEnum.SYSTEM),
    ).toThrow(new BadRequestException('messageType 无效'))
  })
})
