import { BadRequestException } from '@nestjs/common'
import type { DrizzleService } from '@db/core'
import { MessageNotificationDeliveryService } from './notification-delivery.service'

function createDrizzleStub() {
  return {
    db: {},
    schema: {
      notificationDelivery: {
        status: 'status',
        categoryKey: 'categoryKey',
        eventKey: 'eventKey',
        receiverUserId: 'receiverUserId',
        projectionKey: 'projectionKey',
        eventId: 'eventId',
        dispatchId: 'dispatchId',
      },
    },
  } as unknown as DrizzleService
}

describe('MessageNotificationDeliveryService', () => {
  it('throws 400 for invalid eventId filter', async () => {
    const service = new MessageNotificationDeliveryService(createDrizzleStub())

    await expect(
      service.getNotificationDeliveryPage({
        eventId: 'abc',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('throws 400 for invalid dispatchId filter', async () => {
    const service = new MessageNotificationDeliveryService(createDrizzleStub())

    await expect(
      service.getNotificationDeliveryPage({
        dispatchId: '-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
