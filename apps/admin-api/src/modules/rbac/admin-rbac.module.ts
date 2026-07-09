import { Global, Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { AdminRbacCacheService } from './admin-rbac-cache.service'
import { AdminRbacMetadataService } from './admin-rbac-metadata.service'
import { AdminRbacSyncService } from './admin-rbac-sync.service'
import { AdminRbacController } from './admin-rbac.controller'
import { AdminRbacGuard } from './admin-rbac.guard'
import { AdminRbacService } from './admin-rbac.service'

@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [AdminRbacController],
  providers: [
    AdminRbacCacheService,
    AdminRbacGuard,
    AdminRbacMetadataService,
    AdminRbacService,
    AdminRbacSyncService,
  ],
  exports: [AdminRbacGuard, AdminRbacService],
})
export class AdminRbacModule {}
