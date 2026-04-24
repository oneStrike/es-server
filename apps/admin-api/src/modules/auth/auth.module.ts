import { IdentityModule } from '@libs/identity/identity.module';
import { AuthCronService } from '@libs/platform/modules/auth/auth-cron.service'
import { AuthStrategy } from '@libs/platform/modules/auth/auth.strategy'

import { CaptchaService } from '@libs/platform/modules/captcha/captcha.service'
import { Module } from '@nestjs/common'
import { AuditModule } from '../system/audit/audit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AdminTokenStorageService } from './token-storage.service'

@Module({
  controllers: [AuthController],
  imports: [
    AuditModule,
    IdentityModule.register({
      tokenStorageProvider: {
        provide: 'ITokenStorageService',
        useClass: AdminTokenStorageService,
      },
    }),
  ],
  providers: [
    AuthService,
    CaptchaService,
    AdminTokenStorageService,
    AuthStrategy,
    AuthCronService,
    {
      provide: 'ITokenStorageService',
      useClass: AdminTokenStorageService,
    },
  ],
  exports: [AuthService, AdminTokenStorageService],
})
export class AuthModule {}
