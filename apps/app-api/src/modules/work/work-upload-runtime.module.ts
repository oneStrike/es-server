import { WorkUploadRuntimeModule } from '@libs/content/work/content/work-upload-runtime.module'
import { Module } from '@nestjs/common'
import { UploadModule } from '../system/upload/upload.module'

/** App API 的内容上传运行时组合，复用根级唯一通用上传装配。 */
@Module({
  imports: [
    WorkUploadRuntimeModule.register({
      uploadRuntimeModule: UploadModule,
    }),
  ],
  exports: [WorkUploadRuntimeModule],
})
export class AppWorkUploadRuntimeModule {}
