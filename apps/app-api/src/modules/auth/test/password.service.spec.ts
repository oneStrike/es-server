import { BadRequestException } from '@nestjs/common'
import { AppAuthErrorMessages } from '../auth.constant'

jest.mock('@libs/platform/modules/auth/auth.helpers', () => ({
  createAuthRedisKeys: jest.fn(() => ({
    LOGIN_LOCK: (userId: number) => `app:login-lock:${userId}`,
    LOGIN_FAIL_COUNT: (userId: number) => `app:login-fail:${userId}`,
  })),
}))

jest.mock('@libs/platform/modules/auth/auth.constant', () => ({
  RevokeTokenReasonEnum: {
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  },
}))

jest.mock('@libs/platform/modules/crypto/rsa.service', () => ({
  RsaService: class {},
}))

jest.mock('@libs/platform/modules/crypto/scrypt.service', () => ({
  ScryptService: class {},
}))

jest.mock('@libs/user/user.service', () => ({
  UserService: class {},
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

function createReturningUpdateHarness(rows: unknown[]) {
  const returning = jest.fn().mockResolvedValue(rows)
  const where = jest.fn(() => ({ returning }))
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))

  return {
    update,
    set,
    where,
    returning,
  }
}

function createAppUserTableMock() {
  return {
    id: 'id',
    phoneNumber: 'phoneNumber',
    deletedAt: 'deletedAt',
    password: 'password',
    isEnabled: 'isEnabled',
    status: 'status',
    banReason: 'banReason',
    banUntil: 'banUntil',
  }
}

async function createPasswordService(overrides?: {
  drizzle?: Record<string, unknown>
  rsaService?: Record<string, unknown>
  smsService?: Record<string, unknown>
  scryptService?: Record<string, unknown>
  tokenStorageService?: Record<string, unknown>
  userCoreService?: Record<string, unknown>
}) {
  const { PasswordService } = await import('../password.service')
  const drizzleOverrides = overrides?.drizzle ?? {}
  const {
    db: dbOverrides = {},
    schema: schemaOverrides = {},
    ...restDrizzleOverrides
  } = drizzleOverrides

  const drizzle = {
    db: {
      ...(dbOverrides as Record<string, unknown>),
    },
    schema: {
      appUser: createAppUserTableMock(),
      ...(schemaOverrides as Record<string, unknown>),
    },
    withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    ),
    assertAffectedRows: jest.fn(),
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
  const tokenStorageService = {
    revokeAllByUserId: jest.fn().mockResolvedValue(undefined),
    ...overrides?.tokenStorageService,
  }
  const userCoreService = {
    ensureAppUserNotBanned: jest.fn(),
    ...overrides?.userCoreService,
  }

  return {
    service: new PasswordService(
      drizzle as any,
      rsaService as any,
      smsService as any,
      scryptService as any,
      tokenStorageService as any,
      userCoreService as any,
    ),
    drizzle,
    smsService,
    scryptService,
    tokenStorageService,
    userCoreService,
  }
}

afterEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('password service forgot-password flow', () => {
  it('returns success without touching verification or persistence when the phone is not registered', async () => {
    const selectHarness = createSelectHarness([])
    const updateHarness = createReturningUpdateHarness([{ id: 1 }])

    const { service, smsService, tokenStorageService } =
      await createPasswordService({
        drizzle: {
          db: {
            select: selectHarness.select,
            update: updateHarness.update,
          },
        },
      })

    await expect(
      service.forgotPassword({
        phone: '13800138000',
        code: '123456',
        password: 'new-password',
      }),
    ).resolves.toBe(true)

    expect(smsService.validateVerifyCode).not.toHaveBeenCalled()
    expect(updateHarness.update).not.toHaveBeenCalled()
    expect(tokenStorageService.revokeAllByUserId).not.toHaveBeenCalled()
  })

  it('validates the sms verify code before updating the persisted password hash', async () => {
    const user = {
      id: 1,
      isEnabled: true,
      status: 0,
      banReason: null,
      banUntil: null,
    }
    const selectHarness = createSelectHarness([user])
    const updateHarness = createReturningUpdateHarness([{ id: user.id }])
    const validateVerifyCode = jest.fn().mockRejectedValue(
      new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED),
    )
    const encryptPassword = jest.fn()

    const { service } = await createPasswordService({
      drizzle: {
        db: {
          select: selectHarness.select,
          update: updateHarness.update,
        },
      },
      smsService: { validateVerifyCode },
      scryptService: { encryptPassword },
    })

    await expect(
      service.forgotPassword({
        phone: '13800138000',
        code: '123456',
        password: 'new-password',
      }),
    ).rejects.toThrow(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED)

    expect(validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '123456',
    })
    expect(encryptPassword).not.toHaveBeenCalled()
    expect(updateHarness.update).not.toHaveBeenCalled()
  })

  it('rehashes the new password and revokes all existing sessions after a verified reset', async () => {
    const user = {
      id: 1,
      isEnabled: true,
      status: 0,
      banReason: null,
      banUntil: null,
    }
    const selectHarness = createSelectHarness([user])
    const updateHarness = createReturningUpdateHarness([{ id: user.id }])
    const validateVerifyCode = jest.fn().mockResolvedValue(true)
    const encryptPassword = jest.fn().mockResolvedValue('hashed-password')
    const revokeAllByUserId = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()

    const { service, userCoreService } = await createPasswordService({
      drizzle: {
        db: {
          select: selectHarness.select,
          update: updateHarness.update,
        },
        assertAffectedRows,
      },
      smsService: { validateVerifyCode },
      scryptService: { encryptPassword },
      tokenStorageService: { revokeAllByUserId },
    })

    await expect(
      service.forgotPassword({
        phone: '13800138000',
        code: '123456',
        password: 'new-password',
      }),
    ).resolves.toBe(true)

    expect(userCoreService.ensureAppUserNotBanned).toHaveBeenCalledWith(user)
    expect(validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800138000',
      code: '123456',
    })
    expect(encryptPassword).toHaveBeenCalledWith('new-password')
    expect(updateHarness.set).toHaveBeenCalledWith({
      password: 'hashed-password',
    })
    expect(assertAffectedRows).toHaveBeenCalledWith(
      [{ id: user.id }],
      AppAuthErrorMessages.ACCOUNT_NOT_FOUND,
    )
    expect(revokeAllByUserId).toHaveBeenCalledWith(1, 'PASSWORD_CHANGE')
  })
})
