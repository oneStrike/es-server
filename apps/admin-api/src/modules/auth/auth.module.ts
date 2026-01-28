import { CaptchaService } from '@libs/base/modules'
import { AuthCronService, AuthStrategy } from '@libs/base/modules/auth'
import { Module } from '@nestjs/common'
import { AuditModule } from '../system/audit/audit.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AdminTokenStorageService } from './token-storage.service'

@Module({
  controllers: [AuthController],
  imports: [AuditModule],
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
