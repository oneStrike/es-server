import { Module } from '@nestjs/common'
import { AdminUserController } from '@/modules/admin/user/user.controller'
import { AdminUserService } from '@/modules/admin/user/user.service'

@Module({
  imports: [],
  controllers: [AdminUserController],
  providers: [AdminUserService],
  exports: [AdminUserService],
})
export class AdminUserModule {}
