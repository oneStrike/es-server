import { Module } from '@nestjs/common'
import { CaptchaService } from './captcha.service'

/** 验证码基础设施的唯一 provider owner。 */
@Module({
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
