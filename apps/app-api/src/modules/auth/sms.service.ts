import { BaseService } from '@libs/base/database'
import {
  CheckVerifyCodeDto,
  SmsService as LibSmsService,
  SendVerifyCodeDto,
  SmsTemplateCodeEnum,
} from '@libs/base/modules'
import { BadRequestException, Injectable } from '@nestjs/common'
import { AuthErrorMessages } from './auth.constant'

/**
 * 短信服务类
 * 负责发送验证码、校验验证码等短信相关操作
 */
@Injectable()
export class SmsService extends BaseService {
  constructor(private readonly libSmsService: LibSmsService) {
    super()
  }

  get appUser() {
    return this.prisma.appUser
  }

  /**
   * 发送验证码
   * @param dto - 验证码发送请求DTO，包含手机号和短信模板代码
   */
  async sendVerifyCode(dto: SendVerifyCodeDto) {
    if (
      SmsTemplateCodeEnum.VERIFY_BIND_PHONE === dto.templateCode ||
      SmsTemplateCodeEnum.RESET_PASSWORD === dto.templateCode
    ) {
      if (!(await this.appUser.exists({ phone: dto.phone }))) {
        throw new BadRequestException(AuthErrorMessages.ACCOUNT_NOT_FOUND)
      }
    }
    if (await this.libSmsService.sendVerifyCode(dto)) {
      return true
    }
    throw new BadRequestException(AuthErrorMessages.VERIFY_CODE_SEND_FAILED)
  }

  /**
   * 校验验证码
   * @param dto - 验证码校验请求DTO，包含手机号、验证码和短信模板代码
   */
   async validateVerifyCode(dto: CheckVerifyCodeDto) {
    if (await this.libSmsService.checkVerifyCode(dto)) {
      return true
    }
    throw new BadRequestException(AuthErrorMessages.VERIFY_CODE_CHECK_FAILED)
  }
}
