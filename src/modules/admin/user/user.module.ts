import { Module } from '@nestjs/common'
import { AdminAuthModule } from '@/modules/admin/auth/auth.module' // 导入 AdminAuthModule
import { AdminUserController } from '@/modules/admin/user/user.controller'
import { AdminUserService } from '@/modules/admin/user/user.service'
import { SharedModule } from '@/modules/shared/shared.module'

@Module({
  imports: [AdminAuthModule, SharedModule], // 注入共享模块以获取 RequestLogService
  controllers: [AdminUserController],
  providers: [AdminUserService],
  exports: [],
})
export class AdminUserModule {}
