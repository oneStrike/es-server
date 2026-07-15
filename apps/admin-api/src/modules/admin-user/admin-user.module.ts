import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AdminUserController } from './admin-user.controller'

@Module({
  imports: [AuthModule],
  controllers: [AdminUserController],
})
export class AdminUserModule {}
