import { BadRequestException } from '@nestjs/common'
import { AppAuthErrorMessages } from './auth.constant'
import { PasswordService } from './password.service'

jest.mock('@libs/platform/modules/auth/auth.helpers', () => ({
  createAuthRedisKeys: jest.fn(() => ({
    LOGIN_LOCK: (userId: number) => `app:login-lock:${userId}`,
    LOGIN_FAIL_COUNT: (userId: number) => `app:login-fail:${userId}`,
  }))
}))

jest.mock('@libs/platform/modules/auth/auth.constant', () => ({
  RevokeTokenReasonEnum: {
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  }
}))

jest.mock('@libs/platform/modules/crypto/rsa.service', () => ({
  RsaService: class {}
}))

jest.mock('@libs/platform/modules/crypto/scrypt.service', () => ({
  ScryptService: class {}
}))

jest.mock('@libs/user/core', () => ({
  UserService: class {},
}))

jest.mock('./token-storage.service', () => ({
  AppTokenStorageService: class {},
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

describe('password service', () => {
  it('validates verify code before resetting password', async () => {
    const user = {
      id: 1,
      isEnabled: true,
      status: 0,
      banReason: null,
      banUntil: null,
    }
    const selectMock = createSelectMock([user])
    const returning = jest.fn().mockResolvedValue([{ id: user.id }])
    const where = jest.fn(() => ({ returning }))
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const validateVerifyCode = jest.fn().mockRejectedValue(
      new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED),
    )
    const withErrorHandling = jest.fn(async (callback: () => Promise<unknown>) =>
      callback(),
    )

    const service = new PasswordService(
      {
        db: {
          select: selectMock.select,
          update,
        },
        schema: {
          appUser: {
            id: 'id',
            phoneNumber: 'phoneNumber',
            deletedAt: 'deletedAt',
            password: 'password',
          },
        },
        withErrorHandling,
        assertAffectedRows: jest.fn(),
      } as any,
      {} as any,
      { validateVerifyCode } as any,
      { encryptPassword: jest.fn().mockResolvedValue('hashed-password') } as any,
      { revokeAllByUserId: jest.fn() } as any,
      { ensureAppUserNotBanned: jest.fn() } as any,
    )

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
    expect(withErrorHandling).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
