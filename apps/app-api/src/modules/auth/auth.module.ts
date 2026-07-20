import { SystemConfigModule } from '@libs/config/system-config/system-config.module'
import { AppUserGrowthProfileModule } from '@libs/growth/app-user-growth-profile.module'
import { AuthCronService } from '@libs/platform/modules/auth/auth-cron.service'
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { AuthStrategy } from '@libs/platform/modules/auth/auth.strategy'
import { TOKEN_STORAGE_SERVICE } from '@libs/platform/modules/auth/helpers'
import { AuthSessionService } from '@libs/platform/modules/auth/session.service'
import { CaptchaModule } from '@libs/platform/modules/captcha/captcha.module'
import { SmsModule } from '@libs/platform/modules/sms/sms.module'
import { AppUserTokenStorageService } from '@libs/user/token/app-user-token-storage.service'
import { UserModule as UserCoreModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AppUserStatusGuard } from './app-user-status.guard'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PasswordService } from './password.service'
import { SmsService } from './sms.service'

@Module({
  controllers: [AuthController],
  imports: [
    JwtAuthModule,
    CaptchaModule,
    AppUserGrowthProfileModule,
    UserCoreModule,
    SmsModule.register({
      imports: [SystemConfigModule],
    }),
  ],
  providers: [
    AuthService,
    PasswordService,
    AppUserStatusGuard,
    SmsService,
    AuthSessionService,
    AuthStrategy,
    AuthCronService,
    {
      provide: TOKEN_STORAGE_SERVICE,
      useExisting: AppUserTokenStorageService,
    },
  ],
  exports: [AuthService, PasswordService, SmsService],
})
export class AuthModule {}
