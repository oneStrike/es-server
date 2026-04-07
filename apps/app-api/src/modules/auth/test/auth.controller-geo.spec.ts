jest.mock('@libs/platform/decorators', () => ({
  ApiDoc: () => () => undefined,
  CurrentUser: () => () => undefined,
  Public: () => () => undefined,
}))

jest.mock('@libs/platform/modules/auth', () => ({
  ChangePasswordDto: class {},
  ForgotPasswordDto: class {},
  LoginDto: class {},
  LoginResponseDto: class {},
  RefreshTokenDto: class {},
  RsaPublicKeyDto: class {},
  TokenDto: class {},
}))

jest.mock('@libs/platform/modules/crypto', () => ({
  RsaService: class {},
}))

jest.mock('@libs/platform/modules/geo', () => ({
  GeoService: class {},
}))

jest.mock('@libs/platform/modules/sms', () => ({
  SendVerifyCodeDto: class {},
}))

jest.mock('../auth.service', () => ({
  AuthService: class {},
}))

jest.mock('../password.service', () => ({
  PasswordService: class {},
}))

jest.mock('../sms.service', () => ({
  SmsService: class {},
}))

describe('app auth controller geo context', () => {
  it('uses the geo service for login and refresh request context', async () => {
    const { AuthController } = await import('../auth.controller')

    const authService = {
      login: jest.fn().mockResolvedValue({ ok: true }),
      refreshToken: jest.fn().mockResolvedValue({ ok: true }),
    }
    const geoContext = {
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      geoCountry: '中国',
      geoSource: 'ip2region',
    }
    const buildClientRequestContext = jest.fn().mockResolvedValue(geoContext)

    const controller = new AuthController(
      { getPublicKey: jest.fn() } as any,
      authService as any,
      { sendVerifyCode: jest.fn() } as any,
      { forgotPassword: jest.fn(), changePassword: jest.fn() } as any,
      {
        buildClientRequestContext,
      } as any,
    )

    await controller.login({ phone: '13800000000', code: '1234' } as any, {} as any)
    await controller.refreshToken({ refreshToken: 'refresh-token' } as any, {} as any)

    expect(buildClientRequestContext).toHaveBeenCalledTimes(2)
    expect(authService.login).toHaveBeenCalledWith(
      { phone: '13800000000', code: '1234' },
      geoContext,
    )
    expect(authService.refreshToken).toHaveBeenCalledWith(
      { refreshToken: 'refresh-token' },
      geoContext,
    )
  })
})
