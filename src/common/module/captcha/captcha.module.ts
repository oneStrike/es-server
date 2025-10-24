import { Module } from '@nestjs/common'
import { CaptchaService } from './captcha.service'

/**
 * 验证码模块
 * 提供验证码生成和验证功能
 */
@Module({
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
