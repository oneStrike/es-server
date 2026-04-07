jest.mock('@libs/platform/modules/auth/auth.constant', () => ({
  AuthDefaultValue: {
    IP_ADDRESS_UNKNOWN: 'unknown',
  },
  AuthErrorMessages: {
    LOGIN_INVALID: '登录无效',
  },
  RevokeTokenReasonEnum: {
    TOKEN_REFRESH: 'TOKEN_REFRESH',
    USER_LOGOUT: 'USER_LOGOUT',
  },
}))

jest.mock('@libs/platform/modules/auth/auth.service', () => ({
  AuthService: class {},
}))

describe('auth session service geo persistence', () => {
  it('persists geo fields for both access and refresh tokens', async () => {
    const { AuthSessionService } = await import('../session.service')

    const decodeToken = jest
      .fn()
      .mockResolvedValueOnce({
        jti: 'access-jti',
        exp: 1_900_000_000,
      })
      .mockResolvedValueOnce({
        jti: 'refresh-jti',
        exp: 1_900_000_100,
      })
    const createTokens = jest.fn().mockResolvedValue(2)

    const service = new AuthSessionService(
      { decodeToken } as any,
      { createTokens } as any,
    )

    await service.persistTokens(
      7,
      {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      {
        ip: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      },
    )

    expect(createTokens).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 7,
        jti: 'access-jti',
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
      expect.objectContaining({
        userId: 7,
        jti: 'refresh-jti',
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
    ])
  })
})
