import { Module } from '@nestjs/common'
import { CryptoService } from '@/common/module/jwt/crypto.service'
import { AdminAuthModule } from '@/modules/admin/auth/auth.module' // 导入 AdminAuthModule
import { AdminUserController } from '@/modules/admin/users/user.controller'
import { AdminUserService } from '@/modules/admin/users/user.service'
import { RequestLogModule } from '@/modules/shared/request-log/request-log.module'

@Module({
  imports: [AdminAuthModule, RequestLogModule], // 添加 AdminAuthModule, RequestLogModule 到 imports 数组
  controllers: [AdminUserController],
  providers: [AdminUserService, CryptoService],
  exports: [],
})
export class AdminUserModule {}
