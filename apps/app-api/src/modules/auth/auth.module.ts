import { ForumModule } from '@libs/forum/forum.module'
import { IdentityModule } from '@libs/identity/identity.module'
import { AppUserTokenStorageService } from '@libs/identity/token/app-user-token-storage.service'
import {
  AuthCronService,
  AuthStrategy,
  JwtAuthModule,
} from '@libs/platform/modules/auth'
import { CaptchaService } from '@libs/platform/modules/captcha'
import { RsaService, ScryptService } from '@libs/platform/modules/crypto'
import { SmsModule } from '@libs/platform/modules/sms'
import { SystemConfigModule } from '@libs/system-config/system-config.module'
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
    IdentityModule.register({
      tokenStorageProvider: {
        provide: 'ITokenStorageService',
        useClass: AppUserTokenStorageService,
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
    AppUserTokenStorageService,
    AuthCronService,
    AuthStrategy,
    AppUserStatusGuard,
    SmsService,
    /**
     * 复用模块内同一个 AppUserTokenStorageService 实例，避免本地 provider 重复实例化。
     */
    {
      provide: 'ITokenStorageService',
      useExisting: AppUserTokenStorageService,
    },
  ],
  exports: [
    AuthService,
    PasswordService,
    AppUserTokenStorageService,
    SmsService,
  ],
})
export class AuthModule {}
