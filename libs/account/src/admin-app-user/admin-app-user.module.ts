import { DrizzleModule } from '@db/core'
import { AdminAppUserGrowthModule } from '@libs/growth/admin-app-user/admin-app-user-growth.module'
import { AppUserGrowthProfileModule } from '@libs/growth/app-user-growth-profile.module'
import { GrowthLedgerModule } from '@libs/growth/growth-ledger/growth-ledger.module'
import { IdentityTokenStorageModule } from '@libs/identity/token/identity-token-storage.module'
import { CryptoModule } from '@libs/platform/modules/crypto/crypto.module'
import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { AdminAppUserCommandService } from './admin-app-user-command.service'
import { AdminAppUserQueryService } from './admin-app-user-query.service'

/** account/read-model owner：管理端 APP 用户目录和账号命令模块。 */
@Module({
  imports: [
    DrizzleModule,
    IdentityTokenStorageModule,
    UserModule,
    CryptoModule,
    GrowthLedgerModule,
    AdminAppUserGrowthModule,
    AppUserGrowthProfileModule,
  ],
  providers: [AdminAppUserCommandService, AdminAppUserQueryService],
  exports: [AdminAppUserCommandService, AdminAppUserQueryService],
})
export class AdminAppUserModule {}
