import { BaseService } from '@libs/base/database'
import { RsaService, ScryptService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { AuthErrorMessages } from './auth.constant'
import { ChangePasswordDto, ForgotPasswordDto } from './dto/auth.dto'
import { SmsService } from './sms.service'
import { AppTokenStorageService } from './token-storage.service'

/**
 * 密码服务类
 * 负责处理密码重置、修改密码等安全相关操作
 */
@Injectable()
export class PasswordService extends BaseService {
  constructor(
    private readonly rsaService: RsaService,
    private readonly smsService: SmsService,
    private readonly scryptService: ScryptService,
    private readonly tokenStorageService: AppTokenStorageService,
  ) {
    super()
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 找回密码
   * @param body - 找回密码数据，包含账号和新密码
   * @returns 找回结果
   * @throws {BadRequestException} 账号不存在
   */
  async forgotPassword(body: ForgotPasswordDto) {
    const { phone, code, password } = body
    const user = await this.appUser.findUnique({
      where: { phone },
      select: { id: true },
    })

    if (!user) {
      throw new BadRequestException(AuthErrorMessages.ACCOUNT_NOT_FOUND)
    }
    await this.smsService.validateVerifyCode({ phone, code })
    const hashedPassword = await this.scryptService.encryptPassword(password)

    await this.prisma.appUser.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })

    await this.tokenStorageService.revokeAllByUserId(user.id, 'PASSWORD_CHANGE')

    return true
  }

  /**
   * 修改密码
   * @param userId - 用户ID
   * @param body - 修改密码数据
   * @returns 修改结果
   */
  async changePassword(userId: number, body: ChangePasswordDto) {
    const user = await this.appUser.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new BadRequestException(AuthErrorMessages.ACCOUNT_NOT_FOUND)
    }

    // 验证旧密码
    const oldPassword = this.rsaService.decryptWith(body.oldPassword)
    const isPasswordValid = await this.scryptService.verifyPassword(
      oldPassword,
      user.password,
    )

    if (!isPasswordValid) {
      throw new BadRequestException('旧密码错误')
    }

    // 验证新密码
    const newPassword = this.rsaService.decryptWith(body.newPassword)
    const confirmNewPassword = this.rsaService.decryptWith(
      body.confirmNewPassword,
    )

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('两次输入的密码不一致')
    }

    // 更新密码
    const hashedPassword = await this.scryptService.encryptPassword(newPassword)
    await this.prisma.appUser.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    // 撤销其他设备登录
    await this.tokenStorageService.revokeAllByUserId(userId, 'PASSWORD_CHANGE')

    return true
  }

  /**
   * 根据手机号查找用户
   * @param phone - 手机号
   * @returns 用户对象或 null
   */
  private async findUserByPhone(phone: string) {
    return this.appUser.findFirst({
      where: {
        phone,
      },
    })
  }
}
