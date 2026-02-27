import { DownloadModule } from '@libs/interaction/download'
import { UserPermissionModule } from '@libs/user/permission'
import { Module } from '@nestjs/common'
import { ContentPermissionService } from './content-permission.service'

@Module({
  imports: [UserPermissionModule, DownloadModule],
  providers: [ContentPermissionService],
  exports: [ContentPermissionService],
})
export class ContentPermissionModule {}
