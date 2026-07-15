import type { WorkUploadRuntimeModuleRegisterOptions } from './work-upload-runtime.module.type'
import { DrizzleModule } from '@db/core'
import { ContentPermissionModule } from '@libs/content/permission/content-permission.module'
import { InteractionModule } from '@libs/interaction/interaction.module'
import { WorkflowModule } from '@libs/workflow/workflow/workflow.module'
import { DynamicModule, Module } from '@nestjs/common'
import { ContentImportModule } from '../content-import/content-import.module'
import { ComicArchiveImportWorkflowHandler } from './comic-archive-import-workflow.handler'
import { ComicArchiveImportService } from './comic-archive-import.service'
import { ComicContentService } from './comic-content.service'
import { NovelContentService } from './novel-content.service'

/**
 * 内容写入上传运行时模块。
 *
 * 上传服务由应用组合根唯一注册；本模块只显式消费该已配置 runtime，避免内容域重复创建上传 provider。
 */
@Module({})
export class WorkUploadRuntimeModule {
  static register(
    options: WorkUploadRuntimeModuleRegisterOptions,
  ): DynamicModule {
    return {
      module: WorkUploadRuntimeModule,
      imports: [
        DrizzleModule,
        InteractionModule,
        ContentPermissionModule,
        ContentImportModule,
        WorkflowModule,
        options.uploadRuntimeModule,
      ],
      providers: [
        NovelContentService,
        ComicContentService,
        ComicArchiveImportService,
        ComicArchiveImportWorkflowHandler,
      ],
      exports: [
        NovelContentService,
        ComicContentService,
        ComicArchiveImportService,
      ],
    }
  }
}
