import { IdentityAdminRbacModule } from '@libs/identity/admin-rbac.module'
import { Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { AdminRbacMetadataService } from './admin-rbac-metadata.service'
import { AdminRbacSyncService } from './admin-rbac-sync.service'
import { AdminRbacController } from './admin-rbac.controller'
import { AdminRbacGuard } from './admin-rbac.guard'

@Module({
  imports: [DiscoveryModule, IdentityAdminRbacModule],
  controllers: [AdminRbacController],
  providers: [AdminRbacGuard, AdminRbacMetadataService, AdminRbacSyncService],
  exports: [AdminRbacGuard],
})
export class AdminRbacModule {}
