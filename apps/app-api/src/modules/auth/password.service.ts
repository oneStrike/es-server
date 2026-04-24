import type { ITokenStorageService } from '@libs/platform/modules/auth/types'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ChangePasswordDto, ForgotPasswordDto } from '@libs/platform/modules/auth/dto'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service'
import { UserService as UserCoreService } from '@libs/user/user.service'
import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { AppAuthErrorMessages } from './auth.constant'
import { SmsService } from './sms.service'

/**
 * 密码服务类
 * 负责处理密码重置、修改密码等安全相关操作
 */
@Injectable()
export class PasswordService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly rsaService: RsaService,
    private readonly smsService: SmsService,
    private readonly scryptService: ScryptService,
    @Inject('ITokenStorageService')
    private readonly tokenStorageService: ITokenStorageService,
    private readonly userCoreService: UserCoreService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 生成安全的随机密码
   * 密码长度为16位，包含大小写字母、数字和特殊字符
   * @returns 16位随机密码
   */
  generateSecureRandomPassword() {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'

    let password = ''

    for (let i = 0; i < 2; i++) {
      password += uppercase[Math.floor(Math.random() * uppercase.length)]
      password += lowercase[Math.floor(Math.random() * lowercase.length)]
      password += numbers[Math.floor(Math.random() * numbers.length)]
      password += special[Math.floor(Math.random() * special.length)]
    }

    const allChars = uppercase + lowercase + numbers + special
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('')
  }

  /**
   * 找回密码
   * 校验短信验证码后更新手机号绑定账号的密码，并撤销旧会话。
   *
   * @param body - 找回密码数据，包含手机号、验证码和新密码
   * @returns 找回结果
   * @throws {BadRequestException} 账号不存在
   */
  async forgotPassword(body: ForgotPasswordDto) {
    const { phone, code, password } = body
    const [user] = await this.db
      .select({
        id: this.appUser.id,
        isEnabled: this.appUser.isEnabled,
        status: this.appUser.status,
        banReason: this.appUser.banReason,
        banUntil: this.appUser.banUntil,
      })
      .from(this.appUser)
      .where(
        and(
          eq(this.appUser.phoneNumber, phone),
          isNull(this.appUser.deletedAt),
        ),
      )
      .limit(1)

    if (!user) {
      // 对外统一返回，避免通过找回密码接口枚举手机号是否存在。
      return true
    }

    if (!user.isEnabled) {
      throw new ForbiddenException(AppAuthErrorMessages.ACCOUNT_DISABLED)
    }

    this.userCoreService.ensureAppUserNotBanned(user)

    await this.smsService.validateVerifyCode({ phone, code })
    const hashedPassword = await this.scryptService.encryptPassword(password)

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUser)
          .set({ password: hashedPassword })
          .where(eq(this.appUser.id, user.id))
          .returning({ id: this.appUser.id }),
      { notFound: AppAuthErrorMessages.ACCOUNT_NOT_FOUND },
    )

    await this.tokenStorageService.revokeAllByUserId(
      user.id,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }

  /**
   * 修改密码
   * @param userId - 用户ID
   * @param body - 修改密码数据
   * @returns 修改结果
   */
  async changePassword(userId: number, body: ChangePasswordDto) {
    const [user] = await this.db
      .select({ id: this.appUser.id, password: this.appUser.password })
      .from(this.appUser)
      .where(and(eq(this.appUser.id, userId), isNull(this.appUser.deletedAt)))
      .limit(1)

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
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.appUser)
          .set({ password: hashedPassword })
          .where(eq(this.appUser.id, userId))
          .returning({ id: this.appUser.id }),
      { notFound: AppAuthErrorMessages.ACCOUNT_NOT_FOUND },
    )

    // 撤销其他设备登录
    await this.tokenStorageService.revokeAllByUserId(
      userId,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )

    return true
  }
}
