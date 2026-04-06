import { ContentPermissionModule } from '@libs/content/permission/content-permission.module';
import { Module } from '@nestjs/common'
import { DownloadService } from './download.service'

@Module({
  imports: [ContentPermissionModule],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
