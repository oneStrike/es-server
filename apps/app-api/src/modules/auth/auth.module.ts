import { ForumModule } from '@libs/forum/forum.module';
import { IdentityModule } from '@libs/identity/identity.module';
import { AuthCronService } from '@libs/platform/modules/auth/auth-cron.service';
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module';
import { AuthStrategy } from '@libs/platform/modules/auth/auth.strategy';
import { CaptchaService } from '@libs/platform/modules/captcha/captcha.service';
import { RsaService } from '@libs/platform/modules/crypto/rsa.service';
import { ScryptService } from '@libs/platform/modules/crypto/scrypt.service';
import { SmsModule } from '@libs/platform/modules/sms/sms.module';
import { SystemConfigModule } from '@libs/system-config/system-config.module';
import { UserModule as UserCoreModule } from '@libs/user/user.module';
import { Module } from '@nestjs/common'
import { AppUserStatusGuard } from './app-user-status.guard'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'
import { AppTokenStorageService } from './token-storage.service'

@Module({
  controllers: [AuthController],
  imports: [
    JwtAuthModule,
    IdentityModule.register({
      tokenStorageProvider: {
        provide: 'ITokenStorageService',
        useClass: AppTokenStorageService,
      },
    }),
    ForumModule,
    UserCoreModule,
    SmsModule.register({
      imports: [SystemConfigModule],
    }),
  ],
  providers: [
    AuthService,
    PasswordService,
    CaptchaService,
    RsaService,
    ScryptService,
    AppTokenStorageService,
    AuthCronService,
    AuthStrategy,
    AppUserStatusGuard,
    SmsService,
    /**
     * 提供 ITokenStorageService 接口的实现
     * 这样 libs/platform 的 AuthStrategy 可以通过依赖注入使用 AppTokenStorageService
     * 实现了接口与实现的分离，提高了代码的可维护性和可测试性
     */
    {
      provide: 'ITokenStorageService',
      useClass: AppTokenStorageService,
    },
  ],
  exports: [AuthService, PasswordService, AppTokenStorageService, SmsService],
})
export class AuthModule { }
