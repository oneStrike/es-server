import type { FastifyRequest } from 'fastify'
import { BadRequestException } from '@nestjs/common'
import { AppAuthErrorMessages } from './auth.constant'
import { AuthService } from './auth.service'

jest.mock('@libs/platform/modules/auth', () => ({
  createAuthRedisKeys: jest.fn(() => ({
    LOGIN_LOCK: (userId: number) => `app:login-lock:${userId}`,
    LOGIN_FAIL_COUNT: (userId: number) => `app:login-fail:${userId}`,
  })),
  AuthConstants: {
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_FAIL_TTL: 300,
    ACCOUNT_LOCK_TTL: 900,
  },
  AuthDefaultValue: {
    IP_ADDRESS_UNKNOWN: 'unknown',
  },
  AuthService: class {},
  LoginGuardService: class {},
}))

jest.mock('@libs/platform/modules', () => ({
  RsaService: class {},
  ScryptService: class {},
}))

jest.mock('@libs/forum/profile', () => ({
  UserProfileService: class {},
}))

jest.mock('@libs/identity/core', () => ({
  AuthSessionService: class {},
}))

jest.mock('@libs/user/core', () => ({
  UserService: class {},
}))

jest.mock('./password.service', () => ({
  PasswordService: class {},
}))

jest.mock('./sms.service', () => ({
  SmsService: class {},
}))

function createSelectMock<T>(rows: T[]) {
  const limit = jest.fn().mockResolvedValue(rows)
  const where = jest.fn(() => ({ limit }))
  const from = jest.fn(() => ({ where }))
  const select = jest.fn(() => ({ from }))

  return {
    select,
    where,
    from,
    limit,
  }
}

describe('auth service', () => {
  it('validates verify code before registering with phone code login', async () => {
    const validateVerifyCode = jest.fn().mockRejectedValue(
      new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED),
    )
    const withErrorHandling = jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    )
    const returning = jest.fn().mockResolvedValue([
      {
        id: 1,
        account: '100001',
        nickname: '用户100001',
        password: 'hashed-password',
        phoneNumber: '13800138000',
        isEnabled: true,
      },
    ])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const transaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ insert }),
    )

    const service = new AuthService(
      {
        db: { transaction },
        schema: {
          appUser: {
            id: 'id',
            account: 'account',
            nickname: 'nickname',
            password: 'password',
            phoneNumber: 'phoneNumber',
            isEnabled: 'isEnabled',
          },
        },
        withErrorHandling,
      } as any,
      {} as any,
      { validateVerifyCode } as any,
      { encryptPassword: jest.fn().mockResolvedValue('hashed-password') } as any,
      {} as any,
      {} as any,
      { generateSecureRandomPassword: jest.fn().mockReturnValue('TempPassword1!') } as any,
      { initUserProfile: jest.fn() } as any,
      {} as any,
      { ensureAppUserNotBanned: jest.fn() } as any,
    )

    jest.spyOn(service, 'generateUniqueAccount').mockResolvedValue(100001)
    jest.spyOn(service as any, 'handleLoginSuccess').mockResolvedValue({
      user: { id: 1 },
      tokens: {},
    })

    await expect(
      service.register(
        {
          phone: '13800138000',
          code: '123456',
        },
        {} as FastifyRequest,
      ),
    ).rejects.toThrow(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED)

    expect(validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '123456',
    })
    expect(withErrorHandling).not.toHaveBeenCalled()
  })

  it('validates verify code before completing code login', async () => {
    const validateVerifyCode = jest.fn().mockRejectedValue(
      new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED),
    )
    const selectMock = createSelectMock([
      {
        id: 1,
        phoneNumber: '13800138000',
        isEnabled: true,
        status: 0,
        banReason: null,
        banUntil: null,
        password: 'hashed-password',
      },
    ])
    const service = new AuthService(
      {
        db: {
          select: selectMock.select,
        },
        schema: {
          appUser: {
            id: 'id',
            phoneNumber: 'phoneNumber',
            account: 'account',
            deletedAt: 'deletedAt',
          },
        },
      } as any,
      {} as any,
      { validateVerifyCode } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { ensureAppUserNotBanned: jest.fn() } as any,
    )

    jest.spyOn(service as any, 'handleLoginSuccess').mockResolvedValue({
      user: { id: 1 },
      tokens: {},
    })

    await expect(
      service.login(
        {
          phone: '13800138000',
          code: '123456',
        },
        {} as FastifyRequest,
      ),
    ).rejects.toThrow(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED)

    expect(validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '123456',
    })
  })
})
