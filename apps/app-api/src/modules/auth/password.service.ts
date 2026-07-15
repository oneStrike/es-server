import type { ITokenStorageService } from '@libs/platform/modules/auth/types'
import { randomInt } from 'node:crypto'
import { AppUserCredentialService } from '@libs/identity/app-user-credential.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
} from '@libs/platform/modules/auth/dto'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { AppAuthErrorMessages } from './auth.constant'
import { SmsService } from './sms.service'

/**
 * 应用端密码服务。
 * 负责密码重置与修改等安全相关操作。
 */
@Injectable()
export class PasswordService {
  constructor(
    private readonly credentialService: AppUserCredentialService,
    private readonly rsaService: RsaService,
    private readonly smsService: SmsService,
    private readonly scryptService: ScryptService,
    @Inject('ITokenStorageService')
    private readonly tokenStorageService: ITokenStorageService,
    private readonly userCoreService: UserCoreService,
  ) {}

  // 生成含大小写字母、数字与特殊字符的 16 位随机密码。
  generateSecureRandomPassword() {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    const pick = (characters: string) =>
      characters[randomInt(characters.length)]

    let password = ''

    for (let i = 0; i < 2; i++) {
      password += pick(uppercase)
      password += pick(lowercase)
      password += pick(numbers)
      password += pick(special)
    }

    const allChars = uppercase + lowercase + numbers + special
    for (let i = 0; i < 8; i++) {
      password += pick(allChars)
    }

    const passwordChars = password.split('')
    for (let index = passwordChars.length - 1; index > 0; index--) {
      const swapIndex = randomInt(index + 1)
      ;[passwordChars[index], passwordChars[swapIndex]] = [
        passwordChars[swapIndex],
        passwordChars[index],
      ]
    }

    return passwordChars.join('')
  }

  // 找回密码：校验短信验证码后更新密码并撤销旧会话。
  async forgotPassword(body: ForgotPasswordDto) {
    const { phone, code, password } = body
    const user =
      await this.credentialService.findPasswordResetUserByPhone(phone)

    if (!user) {
      // 对外统一返回，避免通过找回密码接口枚举手机号是否存在。
      return true
    }

    if (!user.isEnabled) {
      throw new ForbiddenException(AppAuthErrorMessages.ACCOUNT_DISABLED)
    }

    this.userCoreService.ensureAppUserNotBanned(user)

    await this.smsService.validateVerifyCode({
      phone,
      code,
      templateCode: SmsTemplateCodeEnum.RESET_PASSWORD,
    })
    const plainPassword = this.rsaService.decryptWith(password)
    const hashedPassword =
      await this.scryptService.encryptPassword(plainPassword)

    if (
      !(await this.credentialService.updatePassword(user.id, hashedPassword))
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        AppAuthErrorMessages.ACCOUNT_NOT_FOUND,
      )
    }

    await this.tokenStorageService.revokeAllByUserId(
      user.id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }

  // 修改密码：验证旧密码后更新新密码并撤销已有令牌。
  async changePassword(userId: number, body: ChangePasswordDto) {
    const user =
      await this.credentialService.findPasswordCredentialByUserId(userId)

    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        AppAuthErrorMessages.ACCOUNT_NOT_FOUND,
      )
    }

    // 验证旧密码
    const oldPassword = this.rsaService.decryptWith(body.oldPassword)
    const isPasswordValid = await this.scryptService.verifyPassword(
      oldPassword,
      user.password,
    )

    if (!isPasswordValid) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '旧密码错误',
      )
    }

    // 验证新密码
    const newPassword = this.rsaService.decryptWith(body.newPassword)
    const confirmNewPassword = this.rsaService.decryptWith(
      body.confirmNewPassword,
    )

    if (newPassword !== confirmNewPassword) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '两次输入的密码不一致',
      )
    }

    // 更新密码
    const hashedPassword = await this.scryptService.encryptPassword(newPassword)
    if (
      !(await this.credentialService.updatePassword(userId, hashedPassword))
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        AppAuthErrorMessages.ACCOUNT_NOT_FOUND,
      )
    }

    // 撤销其他设备登录
    await this.tokenStorageService.revokeAllByUserId(
      userId,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }
}
