import { CaptchaService, RsaService, ScryptService, SmsModule } from '@libs/base/modules'
import { AuthCronService, AuthStrategy, JwtAuthModule } from '@libs/base/modules/auth'
import { ForumModule } from '@libs/forum'
import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'
import { AppTokenStorageService } from './token-storage.service'

@Module({
  controllers: [AuthController],
  imports: [JwtAuthModule, ForumModule, SmsModule],
  providers: [
    AuthService,
    PasswordService,
    CaptchaService,
    RsaService,
    ScryptService,
    AppTokenStorageService,
    AuthCronService,
    AuthStrategy,
    SmsService,
    /**
     * 提供 ITokenStorageService 接口的实现
     * 这样 libs/base 的 AuthStrategy 可以通过依赖注入使用 AppTokenStorageService
     * 实现了接口与实现的分离，提高了代码的可维护性和可测试性
     */
    {
      provide: 'ITokenStorageService',
      useClass: AppTokenStorageService,
    },
  ],
  exports: [AuthService, PasswordService, AppTokenStorageService],
})
export class AuthModule { }
