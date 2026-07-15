import { SystemConfigModule } from '@libs/config/system-config/system-config.module'
import { AppUserGrowthProfileModule } from '@libs/growth/app-user-growth-profile.module'
import { IdentityModule } from '@libs/identity/identity.module'
import { AppUserTokenStorageService } from '@libs/identity/token/app-user-token-storage.service'
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { CaptchaModule } from '@libs/platform/modules/captcha/captcha.module'
import { SmsModule } from '@libs/platform/modules/sms/sms.module'
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
    IdentityModule.register({
      tokenStorageService: AppUserTokenStorageService,
    }),
    AppUserGrowthProfileModule,
    UserCoreModule,
    SmsModule.register({
      imports: [SystemConfigModule],
    }),
  ],
  providers: [AuthService, PasswordService, AppUserStatusGuard, SmsService],
  exports: [AuthService, PasswordService, IdentityModule, SmsService],
})
export class AuthModule {}
