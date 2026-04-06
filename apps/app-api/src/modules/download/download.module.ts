import { DownloadModule as DownloadCoreModule } from '@libs/interaction/download/download.module';
import { Module } from '@nestjs/common'
import { DownloadController } from './download.controller'

@Module({
  imports: [DownloadCoreModule],
  controllers: [DownloadController],
})
export class DownloadModule {}
