import type { ComicThirdPartyWorkflowModuleRegisterOptions } from './third-party-workflow.module.type'
import { DrizzleModule } from '@db/core'
import { WorkflowModule } from '@libs/workflow/workflow/workflow.module'
import { DynamicModule, Module } from '@nestjs/common'
import { ContentImportModule } from '../content-import/content-import.module'
import { WorkModule } from '../work.module'
import { ComicThirdPartyService } from './services/comic-third-party.service'
import { ThirdPartyComicImportWorkflowHandler } from './services/third-party-comic-import-workflow.handler'
import { ThirdPartyComicImportService } from './services/third-party-comic-import.service'
import { ThirdPartyComicSyncWorkflowHandler } from './services/third-party-comic-sync-workflow.handler'
import { ThirdPartyComicSyncService } from './services/third-party-comic-sync.service'

/**
 * 三方漫画导入与同步工作流模块。
 *
 * 将 provider 调用、内容写入和 workflow handler 收敛在内容域，管理端仅负责 HTTP 协议。
 */
@Module({})
export class ComicThirdPartyWorkflowModule {
  static register(
    options: ComicThirdPartyWorkflowModuleRegisterOptions,
  ): DynamicModule {
    return {
      module: ComicThirdPartyWorkflowModule,
      imports: [
        DrizzleModule,
        options.workUploadRuntimeModule,
        ContentImportModule,
        WorkModule,
        WorkflowModule,
        options.thirdPartyRuntimeModule,
      ],
      providers: [
        ComicThirdPartyService,
        ThirdPartyComicImportService,
        ThirdPartyComicImportWorkflowHandler,
        ThirdPartyComicSyncService,
        ThirdPartyComicSyncWorkflowHandler,
      ],
      exports: [ComicThirdPartyService],
    }
  }
}
