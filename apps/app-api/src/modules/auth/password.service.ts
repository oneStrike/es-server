import { BaseService } from '@libs/base/database'
import { RsaService, ScryptService, SmsService } from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { ErrorMessages } from './auth.constant'
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ForgotPasswordRequestDto,
} from './dto/auth.dto'
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
   * 发送重置密码验证码
   * @param body - 忘记密码请求数据，仅包含手机号
   * @returns 提示信息
   * @throws {BadRequestException} 账号不存在
   */
  async sendResetPasswordCode(body: ForgotPasswordRequestDto) {
    const user = await this.findUserByPhone(body.phone)

    if (!user) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
    }

    // 发送重置密码验证码
    await this.smsService.sendSmsRequest({
      phoneNumber: body.phone,
      templateCode: '100003', // SmsTemplateCodeEnum.RESET_PASSWORD
    })

    return {
      message: '如果账号存在，重置密码的验证码已发送',
    }
  }

  /**
   * 重置密码
   * @param body - 重置密码数据，包含账号和新密码
   * @returns 重置结果
   * @throws {BadRequestException} 账号不存在
   */
  async resetPassword(body: ForgotPasswordDto) {
    const user = await this.findUserByPhone(body.phone)

    if (!user) {
      throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
    }

    await this.validateVerifyCode(body.phone, body.code)

    const password = this.rsaService.decryptWith(body.password)
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
      throw new BadRequestException(ErrorMessages.ACCOUNT_NOT_FOUND)
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
   * 校验验证码
   * @param phone - 手机号
   * @param code - 验证码
   */
  private async validateVerifyCode(phone: string, code: string) {
    await this.smsService.checkVerifyCode({
      phoneNumber: phone,
      verifyCode: code,
    })
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
