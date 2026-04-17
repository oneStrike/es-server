import { BadRequestException } from '@nestjs/common'
import type { DrizzleService } from '@db/core'
import { MessageMonitorService } from './message-monitor.service'

function createDrizzleStub() {
  return {
    db: {},
  } as unknown as DrizzleService
}

describe('MessageMonitorService', () => {
  it('throws 400 for invalid eventId filter', async () => {
    const service = new MessageMonitorService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    await expect(
      service.getNotificationDispatchPage({
        eventId: 'abc',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('throws 400 for invalid dispatchId filter', async () => {
    const service = new MessageMonitorService(
      createDrizzleStub(),
      {} as never,
      {} as never,
    )

    await expect(
      service.getNotificationDispatchPage({
        dispatchId: '-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
