import type { Db } from '@db/core'
import type {
  ThirdPartyComicImportExpiredAttemptContext,
  ThirdPartyComicImportResidue,
  ThirdPartyComicImportTaskPayload,
  ThirdPartyComicPreparedWorkflowImport,
} from '@libs/content/work/third-party/third-party-comic-import.type'
import type {
  WorkflowExecuteContext,
  WorkflowHandler,
  WorkflowRetryContext,
} from '@libs/platform/modules/workflow/workflow.type'
import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import { RemoteImageImportService } from '@libs/content/work/third-party/services/remote-image-import.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  WorkflowAttemptStatusEnum,
  WorkflowEventTypeEnum,
} from '@libs/platform/modules/workflow/workflow.constant'
import { WorkflowRegistry } from '@libs/platform/modules/workflow/workflow.registry'
import { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ThirdPartyComicImportService } from './third-party-comic-import.service'
import { createWorkflowTaskContext } from './workflow-task-context.adapter'

/** 第三方漫画导入 workflow 处理器。 */
@Injectable()
export class ThirdPartyComicImportWorkflowHandler
  implements OnModuleInit, WorkflowHandler
{
  /** 工作流类型。 */
  readonly workflowType = ContentImportWorkflowType.THIRD_PARTY_IMPORT

  // 初始化 workflow handler 依赖。
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly workflowService: WorkflowService,
    private readonly contentImportService: ContentImportService,
    private readonly importService: ThirdPartyComicImportService,
    private readonly remoteImageImportService: RemoteImageImportService,
  ) {}

  // 注册工作流处理器。
  onModuleInit() {
    this.registry.register(this)
  }

  // 准备重试条目。
  async prepareRetry(
    context: WorkflowRetryContext,
    nextAttemptNo: number,
    tx: Db,
  ) {
    await this.contentImportService.prepareRetryItems(
      context.jobId,
      context.selectedItemIds,
      nextAttemptNo,
      tx,
    )
  }

  // 恢复 claim 过期的 RUNNING attempt。
  async recoverExpiredAttempt(
    context: ThirdPartyComicImportExpiredAttemptContext,
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

  // 清理管理员确认过期后仍需补偿的上传文件残留。
  async cleanupRetainedResources(jobId: string) {
    await this.cleanupPendingUploadedFileResidues(jobId)
  }

  // 执行第三方漫画导入。
  async execute(context: WorkflowExecuteContext) {
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(
        context.jobId,
      )
    const dto = importJob.sourceSnapshot as ThirdPartyComicImportTaskPayload
    const preparationContext = createWorkflowTaskContext<
      ThirdPartyComicImportTaskPayload,
      ThirdPartyComicImportResidue
    >(context, dto, {
      contentImportService: this.contentImportService,
    })
    const items = await this.contentImportService.listExecutableItems(
      context.jobId,
      context.attemptNo,
    )

    let prepared: ThirdPartyComicPreparedWorkflowImport
    try {
      prepared = await this.importService.prepareWorkflowImport(
        dto,
        preparationContext,
      )
      await preparationContext.markUploadedResiduesCleaned()
    } catch (error) {
      await this.importService
        .rollbackImportTask(preparationContext, error)
        .catch(() => undefined)
      await context.assertStillOwned()
      for (const item of items) {
        await this.contentImportService.startItemAttempt(
          context.jobId,
          context.attemptId,
          item.itemId,
        )
        await this.contentImportService.markItemFailed({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          errorCode: 'THIRD_PARTY_IMPORT_PREPARE_FAILED',
          errorMessage: this.stringifyError(error),
          imageTotal: 0,
          imageSuccessCount: 0,
        })
      }
      const counters = await this.contentImportService.aggregateJob(
        context.jobId,
      )
      await context.assertStillOwned()
      await this.workflowService.completeAttemptByAttemptId({
        attemptId: context.attemptId,
        status: WorkflowAttemptStatusEnum.FAILED,
        successItemCount: counters.successItemCount,
        failedItemCount: counters.failedItemCount,
        skippedItemCount: counters.skippedItemCount,
        errorCode: 'THIRD_PARTY_IMPORT_PREPARE_FAILED',
        errorMessage: this.stringifyError(error),
      })
      return
    }

    const planByProviderChapterId = new Map(
      prepared.chapterPlans.map((plan) => [
        plan.chapter.providerChapterId,
        plan,
      ]),
    )
    const imageProgressReporter =
      this.importService.createImportImageProgressReporter(
        preparationContext,
        prepared.chapterPlans,
      )

    for (const item of items) {
      await context.assertNotCancelled()
      await this.contentImportService.startItemAttempt(
        context.jobId,
        context.attemptId,
        item.itemId,
      )
      const chapter = this.readChapterSnapshot(item.metadata)
      const plan = planByProviderChapterId.get(chapter.providerChapterId)
      const itemContext = createWorkflowTaskContext<
        ThirdPartyComicImportTaskPayload,
        ThirdPartyComicImportResidue
      >(context, dto, {
        contentImportService: this.contentImportService,
        itemId: item.itemId,
      })

      try {
        await this.cleanupPendingUploadedFileResidues(context.jobId, item.itemId)
        if (!plan) {
          throw new Error(`导入计划缺少章节 ${chapter.providerChapterId}`)
        }
        const result = await this.importService.importWorkflowChapter(
          prepared,
          plan,
          itemContext,
          imageProgressReporter,
        )
        await context.assertStillOwned()
        await this.contentImportService.markItemSuccess({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          localChapterId: result.localChapterId,
          imageTotal: result.imageTotal,
          imageSuccessCount: result.imageSucceeded,
        })
        await itemContext.markUploadedResiduesCleaned()
        await context.assertStillOwned()
        await context.appendEvent(
          WorkflowEventTypeEnum.ITEM_SUCCEEDED,
          `章节「${chapter.title}」导入成功`,
          { itemId: item.itemId, providerChapterId: chapter.providerChapterId },
        )
      } catch (error) {
        let errorMessage = this.stringifyError(error)
        try {
          await this.importService.rollbackImportTask(itemContext, error)
        } catch (rollbackError) {
          errorMessage = `${errorMessage}; cleanup=${this.stringifyError(
            rollbackError,
          )}`
        }
        await context.assertStillOwned()
        await this.contentImportService.markItemFailed({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          errorCode: 'THIRD_PARTY_IMPORT_CHAPTER_FAILED',
          errorMessage,
          imageTotal: plan?.imageTotal ?? 0,
          imageSuccessCount: 0,
        })
        await context.appendEvent(
          WorkflowEventTypeEnum.ITEM_FAILED,
          `章节「${chapter.title}」导入失败`,
          {
            itemId: item.itemId,
            providerChapterId: chapter.providerChapterId,
            errorMessage,
          },
        )
      }
    }

    const counters = await this.contentImportService.aggregateJob(context.jobId)
    await context.assertStillOwned()
    await this.workflowService.completeAttemptByAttemptId({
      attemptId: context.attemptId,
      status:
        counters.failedItemCount === 0
          ? WorkflowAttemptStatusEnum.SUCCESS
          : counters.successItemCount > 0
            ? WorkflowAttemptStatusEnum.PARTIAL_FAILED
            : WorkflowAttemptStatusEnum.FAILED,
      successItemCount: counters.successItemCount,
      failedItemCount: counters.failedItemCount,
      skippedItemCount: counters.skippedItemCount,
    })
  }

  // 从条目 metadata 中读取预览阶段冻结的三方章节快照。
  private readChapterSnapshot(metadata: unknown) {
    const chapter = (
      metadata as {
        chapter?: ThirdPartyComicImportTaskPayload['chapters'][number]
      } | null
    )?.chapter
    if (!chapter) {
      throw new Error('导入条目缺少章节快照')
    }
    return chapter
  }

  // 将未知异常转换为可持久化的错误文本。
  private stringifyError(error: unknown) {
    if (error instanceof Error) {
      return error.message
    }
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }

  // 清理仍处于 pending/failed 的上传残留，避免重试前覆盖正式文件。
  private async cleanupPendingUploadedFileResidues(jobId: string, itemId?: string) {
    const residues =
      await this.contentImportService.listPendingUploadedFileResidues(jobId, {
        itemId,
      })
    const cleanupFailures: string[] = []
    for (const residue of residues.reverse()) {
      try {
        await this.remoteImageImportService.deleteImportedFile(
          residue.deleteTarget,
        )
        await this.contentImportService.markResiduesCleaned([residue.residueId])
      } catch (error) {
        await this.contentImportService
          .markResidueCleanupFailed(residue.residueId, this.stringifyError(error))
          .catch(() => undefined)
        cleanupFailures.push(
          `${residue.deleteTarget.provider}:${residue.deleteTarget.filePath} (${this.stringifyError(
            error,
          )})`,
        )
      }
    }
    if (cleanupFailures.length > 0) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        `存在无法自动清理的上传文件: ${cleanupFailures.join(', ')}`,
      )
    }
  }
}
