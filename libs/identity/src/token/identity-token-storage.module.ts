import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { AdminUserTokenStorageService } from './admin-user-token-storage.service'
import { AppUserTokenStorageService } from './app-user-token-storage.service'

/**
 * 身份域唯一拥有 token 存储实现。
 *
 * Admin 与 App 运行时通过 IdentityModule 的显式别名选择各自的存储实现，
 * 其他模块只能消费这里导出的实例，不能重复注册具体 token storage provider。
 */
@Module({
  imports: [DrizzleModule],
  providers: [AdminUserTokenStorageService, AppUserTokenStorageService],
  exports: [AdminUserTokenStorageService, AppUserTokenStorageService],
})
export class IdentityTokenStorageModule {}
