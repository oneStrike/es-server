import { appUser } from '@db/schema'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import { PasswordService } from './password.service'

describe('PasswordService forgot password security', () => {
  it('decrypts the submitted RSA password before hashing and revokes old tokens', async () => {
    const user = {
      id: 7,
      isEnabled: true,
      status: 1,
      banReason: null,
      banUntil: null,
    }
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [user]),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn(async () => [{ id: user.id }]),
          })),
        })),
      })),
    }
    const drizzle = {
      db,
      schema: { appUser },
      withErrorHandling: jest.fn((callback) => callback()),
    }
    const rsaService = { decryptWith: jest.fn(() => 'plain-new-password') }
    const smsService = { validateVerifyCode: jest.fn(async () => true) }
    const scryptService = {
      encryptPassword: jest.fn(async () => 'hashed-new-password'),
    }
    const tokenStorageService = {
      revokeAllByUserId: jest.fn(async () => undefined),
    }
    const userCoreService = {
      ensureAppUserNotBanned: jest.fn(() => undefined),
    }
    const service = new PasswordService(
      drizzle as never,
      rsaService as never,
      smsService as never,
      scryptService as never,
      tokenStorageService as never,
      userCoreService as never,
    )

    await service.forgotPassword({
      phone: '13800000000',
      code: '123456',
      password: 'rsa-ciphertext',
    })

    expect(smsService.validateVerifyCode).toHaveBeenCalledWith({
      phone: '13800000000',
      code: '123456',
      templateCode: SmsTemplateCodeEnum.RESET_PASSWORD,
    })
    expect(rsaService.decryptWith).toHaveBeenCalledWith('rsa-ciphertext')
    expect(scryptService.encryptPassword).toHaveBeenCalledWith(
      'plain-new-password',
    )
    expect(tokenStorageService.revokeAllByUserId).toHaveBeenCalledWith(
      user.id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )
  })
})
