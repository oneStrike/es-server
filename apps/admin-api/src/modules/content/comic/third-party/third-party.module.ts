import { ComicThirdPartyWorkflowModule } from '@libs/content/work/third-party/third-party-workflow.module'
import { Module } from '@nestjs/common'
import { AdminWorkUploadRuntimeModule } from '../../work-upload-runtime.module'
import { AdminComicThirdPartyRuntimeModule } from './third-party-runtime.module'
import { ComicThirdPartyController } from './third-party.controller'

@Module({
  imports: [
    ComicThirdPartyWorkflowModule.register({
      thirdPartyRuntimeModule: AdminComicThirdPartyRuntimeModule,
      workUploadRuntimeModule: AdminWorkUploadRuntimeModule,
    }),
  ],
  controllers: [ComicThirdPartyController],
})
export class ComicThirdPartyModule {}
