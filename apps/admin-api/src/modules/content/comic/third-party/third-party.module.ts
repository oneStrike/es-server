import { ComicThirdPartyRuntimeModule } from '@libs/content/work/third-party/third-party.module'
import { WorkModule } from '@libs/content/work/work.module'
import { WorkflowModule } from '@libs/platform/modules/workflow/workflow.module'
import { Module } from '@nestjs/common'
import { ThirdPartyComicImportWorkflowHandler } from './services/third-party-comic-import-workflow.handler'
import { ThirdPartyComicImportService } from './services/third-party-comic-import.service'
import { ThirdPartyComicSyncWorkflowHandler } from './services/third-party-comic-sync-workflow.handler'
import { ThirdPartyComicSyncService } from './services/third-party-comic-sync.service'
import { ComicThirdPartyService } from './third-party-service'
import { ComicThirdPartyController } from './third-party.controller'

@Module({
  imports: [
    WorkModule,
    ComicThirdPartyRuntimeModule,
    WorkflowModule,
  ],
  controllers: [ComicThirdPartyController],
  providers: [
    ComicThirdPartyService,
    ThirdPartyComicImportService,
    ThirdPartyComicImportWorkflowHandler,
    ThirdPartyComicSyncService,
    ThirdPartyComicSyncWorkflowHandler,
  ],
  exports: [ComicThirdPartyService],
})
export class ComicThirdPartyModule {}
