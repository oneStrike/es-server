describe('forum action log geo mapping', () => {
  it('writes geo fields into forum user action log records', async () => {
    const { ForumUserActionLogService } = await import('./action-log.service')

    const returning = jest.fn().mockResolvedValue([{ id: 1 }])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))

    const service = new ForumUserActionLogService({
      db: {
        insert,
      },
      schema: {
        forumUserActionLog: {
          id: 'id',
        },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
    } as any)

    await service.createActionLog({
      userId: 7,
      actionType: 1,
      targetType: 1,
      targetId: 12,
      ipAddress: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    } as any)

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
    )
  })
})
