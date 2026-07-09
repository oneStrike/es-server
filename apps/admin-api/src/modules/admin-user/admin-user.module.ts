import { CryptoModule } from '@libs/platform/modules/crypto/crypto.module'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminSelfProfileLegacyFieldsGuard } from './admin-self-profile-legacy-fields.guard'
import { AdminUserController } from './admin-user.controller'
import { AdminUserService } from './admin-user.service'

@Module({
  imports: [CryptoModule, AuthModule],
  controllers: [AdminUserController],
  providers: [AdminUserService, AdminSelfProfileLegacyFieldsGuard],
  exports: [AdminUserService],
})
export class AdminUserModule {}
