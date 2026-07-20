import { DrizzleModule } from '@db/core'
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { CryptoModule } from '@libs/platform/modules/crypto/crypto.module'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminRbacModule } from '../rbac/admin-rbac.module'
import { AdminUserManagementService } from './admin-user-management.service'
import { AdminUserController } from './admin-user.controller'
import { AdminUserAccountService } from './admin-user.service'

@Module({
  imports: [
    AuthModule,
    AdminRbacModule,
    JwtAuthModule,
    CryptoModule,
    DrizzleModule,
  ],
  controllers: [AdminUserController],
  providers: [AdminUserAccountService, AdminUserManagementService],
})
export class AdminUserModule {}
