import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { DownloadService } from './download.service'

@Module({
  imports: [DrizzleModule],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
