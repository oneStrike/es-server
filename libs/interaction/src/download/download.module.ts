import { UserPermissionModule } from '@libs/user/permission'
import { Module } from '@nestjs/common'
import { DownloadService } from './download.service'

@Module({
  imports: [UserPermissionModule],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
