import { UploadModule } from '@libs/upload'
import { Module } from '@nestjs/common'
import { UploadController } from './upload.controller'

@Module({
  imports: [UploadModule],
  controllers: [UploadController],
  exports: [UploadModule],
})
export class AdminUploadModule {}
