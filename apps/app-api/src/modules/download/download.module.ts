import { DownloadModule as DownloadCoreModule } from '@libs/interaction/download'
import { Module } from '@nestjs/common'
import { DownloadController } from './download.controller'

@Module({
  imports: [DownloadCoreModule],
  controllers: [DownloadController],
})
export class DownloadModule {}
