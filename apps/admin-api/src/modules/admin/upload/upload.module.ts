import { Module } from '@nestjs/common'
import { UploadModule } from '../../system/upload/upload.module'
import { UploadController } from './upload.controller'

@Module({
  imports: [UploadModule],
  controllers: [UploadController],
  exports: [UploadModule],
})
export class AdminUploadModule {}
