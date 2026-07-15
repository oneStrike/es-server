import { ComicThirdPartyRuntimeModule } from '@libs/content/work/third-party/third-party.module'
import { Module } from '@nestjs/common'
import { UploadModule } from '../../../system/upload/upload.module'
import { AdminWorkUploadRuntimeModule } from '../../work-upload-runtime.module'

/** Admin API 三方漫画 provider 的运行时组合。 */
@Module({
  imports: [
    ComicThirdPartyRuntimeModule.register({
      uploadRuntimeModule: UploadModule,
      workUploadRuntimeModule: AdminWorkUploadRuntimeModule,
    }),
  ],
  exports: [ComicThirdPartyRuntimeModule],
})
export class AdminComicThirdPartyRuntimeModule {}
