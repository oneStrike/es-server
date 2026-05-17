import type { Db } from '@db/core'
import type {
  ThirdPartyComicSyncChapterPlan,
  ThirdPartyComicSyncExpiredAttemptContext,
  ThirdPartyComicSyncResidue,
  ThirdPartyComicSyncTaskPayload,
  ThirdPartyComicWorkflowSyncTarget,
} from '@libs/content/work/third-party/third-party-comic-sync.type'
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
import { ThirdPartyComicSyncService } from './third-party-comic-sync.service'
import { createWorkflowTaskContext } from './workflow-task-context.adapter'

/** 第三方漫画最新章节同步 workflow 处理器。 */
@Injectable()
export class ThirdPartyComicSyncWorkflowHandler
  implements OnModuleInit, WorkflowHandler
{
  /** 工作流类型。 */
  readonly workflowType = ContentImportWorkflowType.THIRD_PARTY_SYNC

  // 初始化 workflow handler 依赖。
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly workflowService: WorkflowService,
    private readonly contentImportService: ContentImportService,
    private readonly syncService: ThirdPartyComicSyncService,
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
    context: ThirdPartyComicSyncExpiredAttemptContext,
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

  // 执行三方最新章节同步。
  async execute(context: WorkflowExecuteContext) {
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(
        context.jobId,
      )
    const snapshot = importJob.sourceSnapshot as {
      source: ThirdPartyComicSyncTaskPayload
    }
    const taskContext = createWorkflowTaskContext<
      ThirdPartyComicSyncTaskPayload,
      ThirdPartyComicSyncResidue
    >(context, snapshot.source, {
      contentImportService: this.contentImportService,
    })

    let target: ThirdPartyComicWorkflowSyncTarget
    let items = await this.contentImportService.listExecutableItems(
      context.jobId,
      context.attemptNo,
    )

    try {
      if (context.attemptNo === 1) {
        const prepared = await this.syncService.prepareWorkflowSync(
          snapshot.source,
          taskContext,
        )
        await this.contentImportService.replaceThirdPartySyncItems(
          context.jobId,
          prepared.plans,
          context.attemptNo,
        )
        target = {
          sourceBindingId: prepared.sourceBindingId,
          work: prepared.work,
        }
        items = await this.contentImportService.listExecutableItems(
          context.jobId,
          context.attemptNo,
        )
      } else {
        target = await this.syncService.prepareWorkflowSyncTarget(snapshot.source)
      }
    } catch (error) {
      await this.syncService.rollbackSyncTask(taskContext).catch(() => undefined)
      await context.assertStillOwned()
      const message = this.stringifyError(error)
      for (const item of items) {
        await this.contentImportService.startItemAttempt(
          context.jobId,
          context.attemptId,
          item.itemId,
        )
        await this.contentImportService.markItemFailed({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          errorCode: 'THIRD_PARTY_SYNC_PREPARE_FAILED',
          errorMessage: message,
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
        skippedItemCount: 0,
        errorCode: 'THIRD_PARTY_SYNC_PREPARE_FAILED',
        errorMessage: this.stringifyError(error),
      })
      return
    }

    const plans = items.map((item) => this.readPlanSnapshot(item.metadata))
    const imageProgressReporter = this.syncService.createSyncImageProgressReporter(
      taskContext,
      plans,
    )

    for (const item of items) {
      await context.assertNotCancelled()
      await this.contentImportService.startItemAttempt(
        context.jobId,
        context.attemptId,
        item.itemId,
      )
      const plan = this.readPlanSnapshot(item.metadata)
      const itemContext = createWorkflowTaskContext<
        ThirdPartyComicSyncTaskPayload,
        ThirdPartyComicSyncResidue
      >(context, snapshot.source, {
        contentImportService: this.contentImportService,
        itemId: item.itemId,
      })
      try {
        await this.cleanupPendingUploadedFileResidues(context.jobId, item.itemId)
        const localChapterId = await this.syncService.importWorkflowSyncChapter({
          context: itemContext,
          imageProgressReporter,
          plan,
          sourceBindingId: target.sourceBindingId,
          work: target.work,
        })
        await context.assertStillOwned()
        await this.contentImportService.markItemSuccess({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          localChapterId,
          imageTotal: plan.imageTotal,
          imageSuccessCount: plan.imageTotal,
        })
        await itemContext.markUploadedResiduesCleaned()
        await context.assertStillOwned()
        await context.appendEvent(
          WorkflowEventTypeEnum.ITEM_SUCCEEDED,
          `章节「${plan.title}」同步成功`,
          { itemId: item.itemId, providerChapterId: plan.providerChapterId },
        )
      } catch (error) {
        let errorMessage = this.stringifyError(error)
        try {
          await this.syncService.rollbackSyncTask(itemContext)
        } catch (rollbackError) {
          errorMessage = `${errorMessage}; cleanup=${this.stringifyError(
            rollbackError,
          )}`
        }
        await context.assertStillOwned()
        await this.contentImportService.markItemFailed({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          errorCode: 'THIRD_PARTY_SYNC_CHAPTER_FAILED',
          errorMessage,
          imageTotal: plan.imageTotal,
          imageSuccessCount: 0,
        })
        await context.appendEvent(
          WorkflowEventTypeEnum.ITEM_FAILED,
          `章节「${plan.title}」同步失败`,
          {
            itemId: item.itemId,
            providerChapterId: plan.providerChapterId,
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

  // 从条目 metadata 中读取执行期冻结的同步章节计划。
  private readPlanSnapshot(metadata: unknown): ThirdPartyComicSyncChapterPlan {
    const plan = (metadata as { plan?: ThirdPartyComicSyncChapterPlan } | null)
      ?.plan
    if (!plan) {
      throw new Error('同步条目缺少章节计划快照')
    }
    return plan
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
