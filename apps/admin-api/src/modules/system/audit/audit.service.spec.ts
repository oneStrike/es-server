import { AuditActionTypeEnum } from './audit.constant'

jest.mock('@libs/platform/modules/geo', () => ({
  GeoService: class {},
}))

describe('audit service geo write path', () => {
  it('merges geo fields from the resolved request context into request-log writes', async () => {
    const { AuditService } = await import('./audit.service')

    const returning = jest.fn().mockResolvedValue([{ id: 11 }])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const buildRequestContext = jest.fn().mockResolvedValue({
      ip: '1.2.3.4',
      method: 'POST',
      path: '/api/admin/auth/login',
      userAgent: 'Mozilla/5.0',
      apiType: 'admin',
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    })

    const service = new AuditService(
      {
        schema: {
          requestLog: {
            id: 'id',
          },
        },
        db: {
          insert,
        },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {
        buildRequestContext,
      } as any,
    )

    await expect(
      service.createRequestLog(
        {
          actionType: AuditActionTypeEnum.LOGIN,
          content: '用户登录成功',
          isSuccess: true,
          username: 'admin001',
        },
        {} as any,
      ),
    ).resolves.toEqual({ id: 11 })

    expect(buildRequestContext).toHaveBeenCalled()
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
