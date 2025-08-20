import { Module } from '@nestjs/common'
import { CryptoService } from '@/common/module/jwt/crypto.service'
import { AdminAuthModule } from '@/modules/admin/auth/auth.module' // 导入 AdminAuthModule
import { AdminUserController } from '@/modules/admin/users/user.controller'
import { AdminUserService } from '@/modules/admin/users/user.service'
import { SharedModule } from '@/modules/shared/shared.module'

@Module({
  imports: [AdminAuthModule, SharedModule], // 注入共享模块以获取 RequestLogService
  controllers: [AdminUserController],
  providers: [AdminUserService, CryptoService],
  exports: [],
})
export class AdminUserModule {}
