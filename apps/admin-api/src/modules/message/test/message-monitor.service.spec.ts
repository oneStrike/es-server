jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('@libs/message/outbox', () => ({
  MessageOutboxDomainEnum: {
    NOTIFICATION: 1,
  },
}))

jest.mock('@libs/message/notification', () => ({
  MessageNotificationDeliveryService: class {},
}))

describe('message monitor service', () => {
  it('retries failed notification delivery by bizKey through outbox service', async () => {
    const { MessageMonitorService } = await import('../message-monitor.service')

    const retryFailedEventByBizKey = jest.fn().mockResolvedValue(true)
    const service = new MessageMonitorService(
      {} as any,
      {} as any,
      { retryFailedEventByBizKey } as any,
    )

    await expect(
      service.retryNotificationDeliveryByBizKey(
        'task:reminder:reward:assignment:88',
      ),
    ).resolves.toBe(true)

    expect(retryFailedEventByBizKey).toHaveBeenCalledWith({
      bizKey: 'task:reminder:reward:assignment:88',
      domain: 1,
    })
  })
})
