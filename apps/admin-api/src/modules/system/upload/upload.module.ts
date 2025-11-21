import { UploadModule as BaseUploadModule } from '@libs/upload'
import { Module } from '@nestjs/common'
import { UploadController } from './upload.controller'

@Module({
  imports: [BaseUploadModule],
  controllers: [UploadController],
  exports: [BaseUploadModule],
})
export class UploadModule {}
