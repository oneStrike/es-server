import { AdminAppUserModule } from '@libs/account/admin-app-user/admin-app-user.module'
import { AdminAppUserGrowthModule } from '@libs/growth/admin-app-user/admin-app-user-growth.module'
import { Module } from '@nestjs/common'
import { AppUserController } from './app-user.controller'

@Module({
  imports: [AdminAppUserModule, AdminAppUserGrowthModule],
  controllers: [AppUserController],
})
export class AppUserModule {}
