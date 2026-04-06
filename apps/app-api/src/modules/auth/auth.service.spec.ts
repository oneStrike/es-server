import type { FastifyRequest } from 'fastify'
import { BadRequestException } from '@nestjs/common'
import { AppAuthErrorMessages } from './auth.constant'
import { AuthService } from './auth.service'

jest.mock('@libs/platform/modules/auth/auth.helpers', () => ({
  createAuthRedisKeys: jest.fn(() => ({
    LOGIN_LOCK: (userId: number) => `app:login-lock:${userId}`,
    LOGIN_FAIL_COUNT: (userId: number) => `app:login-fail:${userId}`,
  })),
}))

jest.mock('@libs/platform/modules/auth/auth.constant', () => ({
  AuthConstants: {
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_FAIL_TTL: 300,
    ACCOUNT_LOCK_TTL: 900,
  },
  AuthDefaultValue: {
    IP_ADDRESS_UNKNOWN: 'unknown',
  },
}))

jest.mock('@libs/platform/modules/auth/auth.service', () => ({
  AuthService: class {},
}))

jest.mock('@libs/platform/modules/auth/login-guard.service', () => ({
  LoginGuardService: class {},
}))

jest.mock('@libs/platform/modules/crypto/rsa.service', () => ({
  RsaService: class {},
}))

jest.mock('@libs/platform/modules/crypto/scrypt.service', () => ({
  ScryptService: class {},
}))

jest.mock('@libs/forum/profile/profile.service', () => ({
  UserProfileService: class {},
}))

jest.mock('@libs/identity/session.service', () => ({
  AuthSessionService: class {},
}))

jest.mock('@libs/user/user.service', () => ({
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

function createAppUserTableMock() {
  return {
    id: 'id',
    account: 'account',
    nickname: 'nickname',
    password: 'password',
    phoneNumber: 'phoneNumber',
    avatarUrl: 'avatarUrl',
    emailAddress: 'emailAddress',
    genderType: 'genderType',
    birthDate: 'birthDate',
    signature: 'signature',
    bio: 'bio',
    points: 'points',
    experience: 'experience',
    status: 'status',
    isEnabled: 'isEnabled',
    banReason: 'banReason',
    banUntil: 'banUntil',
    deletedAt: 'deletedAt',
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
    const transaction = jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => callback({ insert }),
    )

    const service = new AuthService(
      {
        db: { transaction },
        schema: { appUser: createAppUserTableMock() },
        withErrorHandling,
      } as any,
      {} as any,
      { validateVerifyCode } as any,
      { encryptPassword: jest.fn().mockResolvedValue('hashed-password') } as any,
      {} as any,
      {} as any,
      {
        generateSecureRandomPassword: jest.fn().mockReturnValue('TempPassword1!'),
      } as any,
      { initUserProfile: jest.fn() } as any,
      {} as any,
      { ensureAppUserNotBanned: jest.fn() } as any,
    )

    jest.spyOn(service, 'generateUniqueAccount').mockResolvedValue(100001 as never)
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
          appUser: createAppUserTableMock(),
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

  it('records a guarded failure when rsa decryption fails during password login', async () => {
    const selectMock = createSelectMock([
      {
        id: 7,
        account: '100007',
        phoneNumber: '13800138000',
        password: 'hashed-password',
        isEnabled: true,
        status: 0,
        banReason: null,
        banUntil: null,
      },
    ])
    const checkLock = jest.fn().mockResolvedValue(undefined)
    const recordFail = jest.fn().mockRejectedValue(
      new BadRequestException('账号或密码错误，还剩 4 次机会'),
    )
    const clearHistory = jest.fn().mockResolvedValue(undefined)
    const verifyPassword = jest.fn()

    const service = new AuthService(
      {
        db: {
          select: selectMock.select,
        },
        schema: {
          appUser: createAppUserTableMock(),
        },
      } as any,
      {
        decryptWith: jest.fn(() => {
          throw new BadRequestException('密码解密失败')
        }),
      } as any,
      {} as any,
      { verifyPassword } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { checkLock, recordFail, clearHistory } as any,
      { ensureAppUserNotBanned: jest.fn() } as any,
    )

    await expect(
      service.login(
        {
          account: '100007',
          password: 'bad-ciphertext',
        },
        {} as FastifyRequest,
      ),
    ).rejects.toThrow('账号或密码错误，还剩 4 次机会')

    expect(checkLock).toHaveBeenCalledWith('app:login-lock:7')
    expect(recordFail).toHaveBeenCalledWith(
      'app:login-fail:7',
      'app:login-lock:7',
      expect.objectContaining({
        maxAttempts: 5,
        failTtl: 300,
        lockTtl: 900,
      }),
    )
    expect(verifyPassword).not.toHaveBeenCalled()
    expect(clearHistory).not.toHaveBeenCalled()
  })

  it('retries registration when account generation collides on the unique constraint', async () => {
    const profileInit = jest.fn().mockResolvedValue(undefined)
    const handleLoginSuccess = jest.fn().mockResolvedValue({
      user: { id: 2 },
      tokens: {},
    })
    const returning = jest
      .fn()
      .mockRejectedValueOnce({
        code: '23505',
        constraint: 'app_user_account_key',
        message: 'duplicate key value violates unique constraint',
      })
      .mockResolvedValueOnce([
        {
          id: 2,
          account: '100002',
          nickname: '用户100002',
          password: 'hashed-password',
          phoneNumber: '13800138000',
          avatarUrl: null,
          emailAddress: null,
          genderType: 0,
          birthDate: null,
          signature: null,
          bio: null,
          points: 0,
          experience: 0,
          status: 1,
          isEnabled: true,
          banReason: null,
          banUntil: null,
        },
      ])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const transaction = jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => callback({ insert }),
    )
    const withErrorHandling = jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    )

    const service = new AuthService(
      {
        db: { transaction },
        schema: { appUser: createAppUserTableMock() },
        withErrorHandling,
        isUniqueViolation: jest.fn((error: { code?: string }) => error?.code === '23505'),
        extractError: jest.fn((error: { constraint?: string }) => error),
        handleError: jest.fn((error: unknown) => {
          throw error
        }),
      } as any,
      {} as any,
      { validateVerifyCode: jest.fn().mockResolvedValue(undefined) } as any,
      { encryptPassword: jest.fn().mockResolvedValue('hashed-password') } as any,
      {} as any,
      {} as any,
      {
        generateSecureRandomPassword: jest.fn().mockReturnValue('TempPassword1!'),
      } as any,
      { initUserProfile: profileInit } as any,
      {} as any,
      { ensureAppUserNotBanned: jest.fn() } as any,
    )

    jest.spyOn(service, 'generateUniqueAccount')
      .mockResolvedValueOnce(100001 as never)
      .mockResolvedValueOnce(100002 as never)
    jest.spyOn(service as any, 'handleLoginSuccess').mockImplementation(
      handleLoginSuccess,
    )

    await expect(
      service.register(
        {
          phone: '13800138000',
        },
        {} as FastifyRequest,
      ),
    ).resolves.toEqual({
      user: { id: 2 },
      tokens: {},
    })

    expect(transaction).toHaveBeenCalledTimes(2)
    expect(returning).toHaveBeenCalledTimes(2)
    expect(profileInit).toHaveBeenCalledTimes(1)
    expect(handleLoginSuccess).toHaveBeenCalledTimes(1)
  })
})
