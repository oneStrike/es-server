import { BaseDrizzleTokenStorageService } from '../token/drizzle-token-storage.base'

class TestTokenStorageService extends BaseDrizzleTokenStorageService<any> {
  protected get tokenTable() {
    return {
      id: 'id',
      jti: 'jti',
      userId: 'userId',
      revokedAt: 'revokedAt',
      expiresAt: 'expiresAt',
    }
  }
}

describe('drizzle token storage geo mapping', () => {
  it('writes geo fields into the token table payload', async () => {
    const returning = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))

    const service = new TestTokenStorageService(
      {
        db: {
          insert,
        },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {
        set: jest.fn().mockResolvedValue(undefined),
      } as any,
    )

    await service.createTokens([
      {
        userId: 7,
        jti: 'access-jti',
        tokenType: 'ACCESS',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        ipAddress: '1.2.3.4',
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      },
    ])

    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
    ])
  })
})
