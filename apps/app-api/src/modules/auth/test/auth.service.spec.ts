import type { SessionClientContext } from '@libs/identity/session.type'
import { BadRequestException } from '@nestjs/common'
import { AppAuthErrorMessages } from '../auth.constant'

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

jest.mock('../password.service', () => ({
  PasswordService: class {},
}))

jest.mock('../sms.service', () => ({
  SmsService: class {},
}))

function createSelectHarness<T>(rows: T[]) {
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

function createUpdateHarness(result: unknown = undefined) {
  const where = jest.fn().mockResolvedValue(result)
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))

  return {
    update,
    set,
    where,
  }
}

const defaultClientContext = {
  ip: '203.0.113.10',
} satisfies SessionClientContext

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
    lastLoginAt: 'lastLoginAt',
    lastLoginIp: 'lastLoginIp',
  }
}

function createAppUser(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    account: '100001',
    nickname: '用户100001',
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
    deletedAt: null,
    ...overrides,
  }
}

async function createAuthService(overrides?: {
  drizzle?: Record<string, unknown>
  rsaService?: Record<string, unknown>
  smsService?: Record<string, unknown>
  scryptService?: Record<string, unknown>
  baseJwtService?: Record<string, unknown>
  authSessionService?: Record<string, unknown>
  passwordService?: Record<string, unknown>
  profileService?: Record<string, unknown>
  loginGuardService?: Record<string, unknown>
  userCoreService?: Record<string, unknown>
}) {
  const { AuthService } = await import('../auth.service')
  const defaultLoginInfoUpdate = createUpdateHarness()
  const drizzleOverrides = overrides?.drizzle ?? {}
  const {
    db: dbOverrides = {},
    schema: schemaOverrides = {},
    ...restDrizzleOverrides
  } = drizzleOverrides

  const drizzle = {
    db: {
      update: defaultLoginInfoUpdate.update,
      ...(dbOverrides as Record<string, unknown>),
    },
    schema: {
      appUser: createAppUserTableMock(),
      ...(schemaOverrides as Record<string, unknown>),
    },
    withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    ),
    isUniqueViolation: jest.fn(() => false),
    extractError: jest.fn((error: unknown) => error),
    handleError: jest.fn((error: unknown) => {
      throw error
    }),
    ...restDrizzleOverrides,
  }
  const rsaService = {
    decryptWith: jest.fn(),
    ...overrides?.rsaService,
  }
  const smsService = {
    validateVerifyCode: jest.fn().mockResolvedValue(true),
    ...overrides?.smsService,
  }
  const scryptService = {
    encryptPassword: jest.fn().mockResolvedValue('hashed-password'),
    verifyPassword: jest.fn().mockResolvedValue(true),
    ...overrides?.scryptService,
  }
  const baseJwtService = {
    generateTokens: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    decodeToken: jest.fn(),
    ...overrides?.baseJwtService,
  }
  const authSessionService = {
    persistTokens: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn(),
    refreshAndPersist: jest.fn(),
    ...overrides?.authSessionService,
  }
  const passwordService = {
    generateSecureRandomPassword: jest.fn().mockReturnValue('TempPassword1!'),
    ...overrides?.passwordService,
  }
  const profileService = {
    initUserProfile: jest.fn().mockResolvedValue(undefined),
    ...overrides?.profileService,
  }
  const loginGuardService = {
    checkLock: jest.fn().mockResolvedValue(undefined),
    recordFail: jest.fn().mockResolvedValue(undefined),
    clearHistory: jest.fn().mockResolvedValue(undefined),
    ...overrides?.loginGuardService,
  }
  const userCoreService = {
    ensureAppUserNotBanned: jest.fn(),
    findById: jest.fn(),
    ...overrides?.userCoreService,
  }

  return {
    service: new AuthService(
      drizzle as any,
      rsaService as any,
      smsService as any,
      scryptService as any,
      baseJwtService as any,
      authSessionService as any,
      passwordService as any,
      profileService as any,
      loginGuardService as any,
      userCoreService as any,
    ),
    drizzle,
    rsaService,
    smsService,
    scryptService,
    baseJwtService,
    authSessionService,
    passwordService,
    profileService,
    loginGuardService,
    userCoreService,
  }
}

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('auth service registration flow', () => {
  it('validates the sms verify code before creating a new account for phone registration', async () => {
    const transaction = jest.fn()
    const encryptPassword = jest.fn()
    const validateVerifyCode = jest.fn().mockRejectedValue(
      new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED),
    )

    const { service } = await createAuthService({
      drizzle: {
        db: { transaction },
      },
      smsService: { validateVerifyCode },
      scryptService: { encryptPassword },
    })

    await expect(
      service.register(
        {
          phone: '13800138000',
          code: '123456',
        },
        defaultClientContext,
      ),
    ).rejects.toThrow(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED)

    expect(validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '123456',
    })
    expect(encryptPassword).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('retries registration after the account unique constraint races and still returns the issued session', async () => {
    const duplicateAccountError = {
      code: '23505',
      constraint: 'app_user_account_key',
      message: 'duplicate key value violates unique constraint',
    }
    const newUser = createAppUser({
      id: 2,
      account: '100002',
      nickname: '用户100002',
    })
    const accountLookup = createSelectHarness([])
    const returning = jest
      .fn()
      .mockRejectedValueOnce(duplicateAccountError)
      .mockResolvedValueOnce([newUser])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const transaction = jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          insert,
          select: accountLookup.select,
        }),
    )
    const loginInfoUpdate = createUpdateHarness()
    const generateTokens = jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    const persistTokens = jest.fn().mockResolvedValue(undefined)
    const initUserProfile = jest.fn().mockResolvedValue(undefined)

    const { service, drizzle } = await createAuthService({
      drizzle: {
        db: {
          transaction,
          update: loginInfoUpdate.update,
        },
        isUniqueViolation: jest.fn(
          (error: { code?: string }) => error?.code === '23505',
        ),
        extractError: jest.fn((error: { constraint?: string }) => error),
      },
      baseJwtService: { generateTokens },
      authSessionService: { persistTokens },
      profileService: { initUserProfile },
    })

    await expect(
      service.register(
        {
          phone: '13800138000',
        },
        defaultClientContext,
      ),
    ).resolves.toEqual({
      user: expect.objectContaining({
        id: 2,
        account: '100002',
        phoneNumber: '13800138000',
      }),
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    })

    expect(transaction).toHaveBeenCalledTimes(2)
    expect(returning).toHaveBeenCalledTimes(2)
    expect(initUserProfile).toHaveBeenCalledTimes(1)
    expect(loginInfoUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastLoginAt: expect.any(Date),
        lastLoginIp: '203.0.113.10',
      }),
    )
    expect(generateTokens).toHaveBeenCalledWith({
      sub: '2',
      phone: '13800138000',
    })
    expect(persistTokens).toHaveBeenCalledWith(
      2,
      {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      defaultClientContext,
    )
    expect(drizzle.handleError).not.toHaveBeenCalled()
  })
})

describe('auth service login flow', () => {
  it('rejects phone code login when the verify code check fails before issuing tokens', async () => {
    const appUser = createAppUser()
    const selectHarness = createSelectHarness([appUser])
    const validateVerifyCode = jest.fn().mockRejectedValue(
      new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED),
    )
    const generateTokens = jest.fn()
    const persistTokens = jest.fn()

    const { service, userCoreService } = await createAuthService({
      drizzle: {
        db: {
          select: selectHarness.select,
        },
      },
      smsService: { validateVerifyCode },
      baseJwtService: { generateTokens },
      authSessionService: { persistTokens },
    })

    await expect(
      service.login(
        {
          phone: '13800138000',
          code: '123456',
        },
        defaultClientContext,
      ),
    ).rejects.toThrow(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED)

    expect(validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '123456',
    })
    expect(userCoreService.ensureAppUserNotBanned).not.toHaveBeenCalled()
    expect(generateTokens).not.toHaveBeenCalled()
    expect(persistTokens).not.toHaveBeenCalled()
  })

  it('records the guarded password failure when rsa decryption breaks before password verification', async () => {
    const appUser = createAppUser({
      id: 7,
      account: '100007',
    })
    const selectHarness = createSelectHarness([appUser])
    const checkLock = jest.fn().mockResolvedValue(undefined)
    const recordFail = jest.fn().mockRejectedValue(
      new BadRequestException('账号或密码错误，还剩 4 次机会'),
    )
    const clearHistory = jest.fn().mockResolvedValue(undefined)
    const verifyPassword = jest.fn()
    const generateTokens = jest.fn()

    const { service } = await createAuthService({
      drizzle: {
        db: {
          select: selectHarness.select,
        },
      },
      rsaService: {
        decryptWith: jest.fn(() => {
          throw new BadRequestException('密码解密失败')
        }),
      },
      scryptService: { verifyPassword },
      baseJwtService: { generateTokens },
      loginGuardService: { checkLock, recordFail, clearHistory },
    })

    await expect(
      service.login(
        {
          account: '100007',
          password: 'bad-ciphertext',
        },
        defaultClientContext,
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
    expect(generateTokens).not.toHaveBeenCalled()
  })
})
