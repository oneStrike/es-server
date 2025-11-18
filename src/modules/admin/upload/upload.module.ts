import { Module } from '@nestjs/common'
import { UploadModule } from '@/modules/system/upload/upload.module'
import { UploadController } from '@/modules/admin/upload/upload.controller'

@Module({
  imports: [UploadModule],
  controllers: [UploadController],
  exports: [UploadModule],
})
export class AdminUploadModule {}
