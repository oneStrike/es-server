import { Module } from '@nestjs/common'
import { SmsService } from './sms.service'

/**
 * 阿里云短信模块
 * 提供短信发送、验证码发送等功能
 */
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
