jest.mock('@libs/platform/decorators/api-doc.decorator', () => ({
  ApiDoc: () => () => undefined,
}))

jest.mock('@libs/platform/decorators/public.decorator', () => ({
  Public: () => () => undefined,
}))

jest.mock('@libs/identity/dto/admin-auth.dto', () => ({
  LoginResponseDto: class {},
  UserLoginDto: class {},
}))

jest.mock('@libs/platform/modules/auth/dto/auth-scene.dto', () => ({
  RefreshTokenDto: class {},
  RsaPublicKeyDto: class {},
  TokenDto: class {},
}))

jest.mock('@libs/platform/modules/captcha/dto/captcha.dto', () => ({
  CaptchaDto: class {},
}))

jest.mock('@libs/platform/modules/geo', () => ({
  GeoService: class {},
}))

jest.mock('@libs/platform/modules/crypto/rsa.service', () => ({
  RsaService: class {},
}))

jest.mock('../../common/decorators/audit.decorator', () => ({
  Audit: () => () => undefined,
}))

jest.mock('./auth.service', () => ({
  AuthService: class {},
}))

describe('admin auth controller geo context', () => {
  it('uses the geo service for login and refresh request context', async () => {
    const { AuthController } = await import('./auth.controller')

    const authService = {
      login: jest.fn().mockResolvedValue({ ok: true }),
      refreshToken: jest.fn().mockResolvedValue({ ok: true }),
      getCaptcha: jest.fn(),
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
      {
        buildClientRequestContext,
      } as any,
    )

    await controller.login(
      {
        username: 'admin001',
        password: 'encrypted',
        captchaId: 'captcha-id',
        captcha: '1234',
      } as any,
      {} as any,
    )
    await controller.refreshToken({ refreshToken: 'refresh-token' } as any, {} as any)

    expect(buildClientRequestContext).toHaveBeenCalledTimes(2)
    expect(authService.login).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'admin001',
      }),
      geoContext,
    )
    expect(authService.refreshToken).toHaveBeenCalledWith(
      { refreshToken: 'refresh-token' },
      geoContext,
    )
  })
})
