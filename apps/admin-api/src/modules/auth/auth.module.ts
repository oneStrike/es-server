import { BaseAuthModule } from '@libs/auth'
import { CaptchaService } from '@libs/captcha'
import { Module } from '@nestjs/common'
import { AuditModule } from '../system/audit/audit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController],
  imports: [BaseAuthModule, AuditModule],
  providers: [AuthService, CaptchaService],
  exports: [AuthService],
})
export class AuthModule {}
