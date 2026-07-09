import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { AdminRbacMetadataService } from './admin-rbac-metadata.service'
import { AdminRbacService } from './admin-rbac.service'

@Injectable()
export class AdminRbacSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminRbacSyncService.name)

  constructor(
    private readonly metadataService: AdminRbacMetadataService,
    private readonly rbacService: AdminRbacService,
  ) {}

  // 应用启动后同步权限元数据并执行 RBAC 首次 bootstrap。
  async onApplicationBootstrap() {
    const definitions = this.metadataService.getPermissionDefinitions()
    await this.rbacService.syncCodePermissions(definitions)
    this.logger.log(`Synced ${definitions.length} admin RBAC permissions`)
  }
}
