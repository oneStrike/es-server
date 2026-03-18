import { CryptoModule } from '@libs/platform/modules'
import { Module } from '@nestjs/common'
import { AdminUserController } from './admin-user.controller'
import { AdminUserService } from './admin-user.service'

@Module({
  imports: [CryptoModule],
  controllers: [AdminUserController],
  providers: [AdminUserService],
  exports: [],
})
export class AdminUserModule {}





