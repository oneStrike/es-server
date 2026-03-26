import { CryptoModule } from '@libs/platform/modules'
import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminUserController } from './admin-user.controller'
import { AdminUserService } from './admin-user.service'

@Module({
  imports: [CryptoModule, AuthModule],
  controllers: [AdminUserController],
  providers: [AdminUserService],
  exports: [],
})
export class AdminUserModule {}
