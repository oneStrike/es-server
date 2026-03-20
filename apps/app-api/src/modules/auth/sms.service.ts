import type {
  AppCheckVerifyCodeInput,
  AppSendVerifyCodeInput,
} from './auth.type'
import { DrizzleService } from '@db/core'
import {
  SmsService as LibSmsService,
  SmsTemplateCodeEnum,
} from '@libs/platform/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { AppAuthErrorMessages } from './auth.constant'

/**
 * 短信服务类
 * 负责发送验证码、校验验证码等短信相关操作
 */
@Injectable()
export class SmsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly libSmsService: LibSmsService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  get appUser() {
    return this.drizzle.schema.appUser
  }

  /**
   * 发送验证码
   * @param dto - 验证码发送请求DTO，包含手机号和短信模板代码
   */
  async sendVerifyCode(dto: AppSendVerifyCodeInput) {
    if (
      SmsTemplateCodeEnum.VERIFY_BIND_PHONE === dto.templateCode ||
      SmsTemplateCodeEnum.RESET_PASSWORD === dto.templateCode
    ) {
      const [user] = await this.db
        .select({ id: this.appUser.id })
        .from(this.appUser)
        .where(
          and(eq(this.appUser.phoneNumber, dto.phone), isNull(this.appUser.deletedAt)),
        )
        .limit(1)
      if (!user) {
        throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_NOT_FOUND)
      }
    }
    if (await this.libSmsService.sendVerifyCode(dto)) {
      return true
    }
    throw new BadRequestException(AppAuthErrorMessages.VERIFY_CODE_SEND_FAILED)
  }

  /**
   * 校验验证码
   * @param dto - 验证码校验请求DTO，包含手机号、验证码和短信模板代码
   */
  async validateVerifyCode(dto: AppCheckVerifyCodeInput) {
    if (await this.libSmsService.checkVerifyCode(dto)) {
      return true
    }
    throw new BadRequestException(
      AppAuthErrorMessages.VERIFY_CODE_CHECK_FAILED,
    )
  }
}
