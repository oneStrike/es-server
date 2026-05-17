import type { Db } from '@db/core'
import type {
  WorkflowExecuteContext,
  WorkflowExpiredAttemptRecoveryContext,
  WorkflowHandler,
} from '@libs/platform/modules/workflow/workflow.type'
import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import { WorkflowRegistry } from '@libs/platform/modules/workflow/workflow.registry'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ComicArchiveImportService } from './comic-archive-import.service'

/** 漫画压缩包导入 workflow 处理器。 */
@Injectable()
export class ComicArchiveImportWorkflowHandler
  implements OnModuleInit, WorkflowHandler
{
  /** 工作流类型。 */
  readonly workflowType = ContentImportWorkflowType.ARCHIVE_IMPORT

  // 初始化压缩包 workflow handler 依赖。
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly archiveImportService: ComicArchiveImportService,
    private readonly contentImportService: ContentImportService,
  ) {}

  // 注册工作流处理器。
  onModuleInit() {
    this.registry.register(this)
  }

  // 执行压缩包导入。
  async execute(context: WorkflowExecuteContext) {
    await this.archiveImportService.executeArchiveWorkflow(context)
  }

  // 恢复 claim 过期的 RUNNING attempt。
  async recoverExpiredAttempt(
    context: WorkflowExpiredAttemptRecoveryContext,
    nextAttemptNo: number,
    tx: Db,
  ) {
    return this.contentImportService.recoverExpiredAttempt(
      context.jobId,
      context.expiredAttemptNo,
      nextAttemptNo,
      tx,
    )
  }

  // 清理过期草稿残留。
  async cleanupExpiredDrafts(jobId: string) {
    await this.archiveImportService.cleanupExpiredDraft(jobId)
  }

  // 清理管理员确认过期的失败任务残留。
  async cleanupRetainedResources(jobId: string) {
    await this.archiveImportService.cleanupRetainedResources(jobId)
  }
}
