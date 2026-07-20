import { DrizzleModule } from '@db/core'
import { AuthCronService } from '@libs/platform/modules/auth/auth-cron.service'
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { AuthStrategy } from '@libs/platform/modules/auth/auth.strategy'
import { TOKEN_STORAGE_SERVICE } from '@libs/platform/modules/auth/helpers'
import { AuthSessionService } from '@libs/platform/modules/auth/session.service'
import { CaptchaModule } from '@libs/platform/modules/captcha/captcha.module'
import { CryptoModule } from '@libs/platform/modules/crypto/crypto.module'
import { Module } from '@nestjs/common'
import { AdminRbacModule } from '../rbac/admin-rbac.module'
import { AuditModule } from '../system/audit/audit.module'
import { AdminAuthAccountService } from './admin-auth-account.service'
import { AdminUserStatusGuard } from './admin-user-status.guard'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AdminUserTokenPersistenceAdapter } from './token/admin-user-token-persistence.adapter'
import { AdminUserTokenStorageService } from './token/admin-user-token-storage.service'

@Module({
  controllers: [AuthController],
  imports: [
    JwtAuthModule,
    DrizzleModule,
    CryptoModule,
    AuditModule,
    CaptchaModule,
    AdminRbacModule,
  ],
  providers: [
    AuthService,
    AuthSessionService,
    AuthStrategy,
    AuthCronService,
    AdminAuthAccountService,
    AdminUserStatusGuard,
    AdminUserTokenPersistenceAdapter,
    AdminUserTokenStorageService,
    {
      provide: TOKEN_STORAGE_SERVICE,
      useExisting: AdminUserTokenStorageService,
    },
  ],
  exports: [AuthService, AdminUserStatusGuard, AdminUserTokenStorageService],
})
export class AuthModule {}
