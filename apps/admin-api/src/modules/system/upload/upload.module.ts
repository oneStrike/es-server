import { UploadModule as BaseUploadModule } from '@libs/platform/modules/upload/upload.module';
import { SystemConfigModule as LibSystemConfigModule } from '@libs/system-config/system-config.module';
import { Module } from '@nestjs/common'
import { UploadController } from './upload.controller'

@Module({
  imports: [
    BaseUploadModule.register({
      imports: [LibSystemConfigModule],
    }),
  ],
  controllers: [UploadController],
  exports: [BaseUploadModule],
})
export class UploadModule {}
