import { UserPermissionModule } from '@libs/user/permission'
import { Module } from '@nestjs/common'
import { DownloadService } from './download.service'
import { ContentPermissionModule } from '@libs/content/permission'

@Module({
  imports: [ContentPermissionModule],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
