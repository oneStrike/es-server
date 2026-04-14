import {
  MessageNotificationDispatchStatusEnum,
} from '@libs/message/notification/notification.constant'
import { DomainEventConsumerEnum, DomainEventDispatchStatusEnum } from '@libs/platform/modules/eventing'
import { MessageMonitorService } from './message-monitor.service'

describe('messageMonitorService', () => {
  function createService() {
    const rows = [
      {
        dispatchId: 21n,
        eventId: 11n,
        consumer: DomainEventConsumerEnum.NOTIFICATION,
        dispatchStatus: DomainEventDispatchStatusEnum.FAILED,
        retryCount: 2,
        lastError: 'consumer boom',
        nextRetryAt: null,
        processedAt: null,
        eventKey: 'comment.replied',
        domain: 'message',
        receiverUserId: 7,
        projectionKey: 'comment-replied:101:receiver:7',
        deliveryStatus: MessageNotificationDispatchStatusEnum.FAILED,
      },
    ]
    let selectCall = 0
    const selectFromMock = jest.fn(() => {
      selectCall += 1
      return {
        leftJoin: jest.fn(() => ({
          leftJoin: jest.fn(() => ({
            where:
              selectCall === 1
                ? jest.fn().mockResolvedValue([{ count: 1 }])
                : jest.fn(() => ({
                    orderBy: jest.fn(() => ({
                      limit: jest.fn(() => ({
                        offset: jest.fn().mockResolvedValue(rows),
                      })),
                    })),
                  })),
          })),
        })),
      }
    })

    const drizzle = {
      db: {
        select: jest.fn(() => ({
          from: selectFromMock,
        })),
      },
    }

    const service = new MessageMonitorService(
      drizzle as never,
      {
        getNotificationDeliveryPage: jest.fn(),
      } as never,
      {
        retryFailedDispatch: jest.fn(),
      } as never,
    )

    return {
      service,
      selectFromMock,
    }
  }

  it('通知 dispatch 分页会固定筛 notification consumer 并序列化 bigint ID', async () => {
    const { service, selectFromMock } = createService()

    const result = await service.getNotificationDispatchPage({
      pageIndex: 1,
      pageSize: 15,
    })

    expect(selectFromMock).toHaveBeenCalled()
    expect(result).toEqual({
      list: [
        expect.objectContaining({
          dispatchId: '21',
          eventId: '11',
          consumer: DomainEventConsumerEnum.NOTIFICATION,
          eventKey: 'comment.replied',
          dispatchStatus: DomainEventDispatchStatusEnum.FAILED,
          deliveryStatus: MessageNotificationDispatchStatusEnum.FAILED,
        }),
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 15,
    })
  })
})
