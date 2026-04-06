import { IS_PUBLIC_KEY } from '@libs/platform/decorators/public.decorator'
import { PATH_METADATA } from '@nestjs/common/constants'

jest.mock('@libs/platform/decorators', () => ({
  ApiDoc: () => () => undefined,
  CurrentUser: () => () => undefined,
  Public: () => {
    const { SetMetadata } = jest.requireActual('@nestjs/common')

    return SetMetadata('isPublic', true)
  },
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

async function loadAuthController() {
  const { AuthController } = await import('../auth.controller')

  return AuthController
}

describe('app AuthController route metadata', () => {
  it('registers stable route segments for verify-code, login, token refresh, and password endpoints', async () => {
    const AuthController = await loadAuthController()

    const sendVerifyCodeHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'sendVerifyCode',
    )?.value
    const getPublicKeyHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'getPublicKey',
    )?.value
    const loginHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'login',
    )?.value
    const logoutHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'logout',
    )?.value
    const refreshTokenHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'refreshToken',
    )?.value
    const forgotPasswordHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'forgotPassword',
    )?.value
    const changePasswordHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'changePassword',
    )?.value

    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('app/auth')
    expect(Reflect.getMetadata(PATH_METADATA, sendVerifyCodeHandler)).toBe(
      'verify-code/send',
    )
    expect(Reflect.getMetadata(PATH_METADATA, getPublicKeyHandler)).toBe(
      'key/public',
    )
    expect(Reflect.getMetadata(PATH_METADATA, loginHandler)).toBe('login')
    expect(Reflect.getMetadata(PATH_METADATA, logoutHandler)).toBe('logout')
    expect(Reflect.getMetadata(PATH_METADATA, refreshTokenHandler)).toBe(
      'token/refresh',
    )
    expect(Reflect.getMetadata(PATH_METADATA, forgotPasswordHandler)).toBe(
      'password/forgot',
    )
    expect(Reflect.getMetadata(PATH_METADATA, changePasswordHandler)).toBe(
      'password/change',
    )
  })

  it('marks only the public auth entrypoints as public routes', async () => {
    const AuthController = await loadAuthController()

    const sendVerifyCodeHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'sendVerifyCode',
    )?.value
    const getPublicKeyHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'getPublicKey',
    )?.value
    const loginHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'login',
    )?.value
    const logoutHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'logout',
    )?.value
    const refreshTokenHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'refreshToken',
    )?.value
    const forgotPasswordHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'forgotPassword',
    )?.value
    const changePasswordHandler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'changePassword',
    )?.value

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, sendVerifyCodeHandler)).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, getPublicKeyHandler)).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, loginHandler)).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, refreshTokenHandler)).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, forgotPasswordHandler)).toBe(true)
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, logoutHandler)).toBeUndefined()
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, changePasswordHandler)).toBeUndefined()
  })
})
