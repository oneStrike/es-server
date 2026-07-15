import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { AdminRbacCacheService } from './admin-rbac-cache.service'
import { AdminRbacService } from './admin-rbac.service'

/**
 * Identity 域拥有的管理端 RBAC 持久化能力。
 *
 * 管理端应用只装配 HTTP controller、guard 与元数据扫描；角色、权限、菜单、
 * 完整性锁和 RBAC 缓存均由此模块提供，避免 app 层持有数据库实现。
 */
@Module({
  imports: [DrizzleModule],
  providers: [AdminRbacCacheService, AdminRbacService],
  exports: [AdminRbacService],
})
export class IdentityAdminRbacModule {}
