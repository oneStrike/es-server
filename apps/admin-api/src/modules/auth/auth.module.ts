import { IdentityAdminRbacModule } from '@libs/identity/admin-rbac.module'
import { IdentityModule } from '@libs/identity/identity.module'
import { AdminUserTokenStorageService } from '@libs/identity/token/admin-user-token-storage.service'
import { CaptchaModule } from '@libs/platform/modules/captcha/captcha.module'
import { Module } from '@nestjs/common'
import { AuditModule } from '../system/audit/audit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController],
  imports: [
    AuditModule,
    CaptchaModule,
    IdentityAdminRbacModule,
    IdentityModule.register({
      tokenStorageService: AdminUserTokenStorageService,
    }),
  ],
  providers: [AuthService],
  exports: [AuthService, IdentityModule],
})
export class AuthModule {}
