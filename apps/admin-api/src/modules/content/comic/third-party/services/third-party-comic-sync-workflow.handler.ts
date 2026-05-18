import type { Db } from '@db/core'
import type {
  ContentImportAttemptCounters,
  ContentImportAttemptCountersWithRetry,
  ContentImportExecutableItem,
} from '@libs/content/work/content-import/content-import.type'
import type {
  ThirdPartyComicSyncChapterPlan,
  ThirdPartyComicSyncExpiredAttemptContext,
  ThirdPartyComicSyncResidue,
  ThirdPartyComicSyncTaskPayload,
  ThirdPartyComicWorkflowSyncTarget,
} from '@libs/content/work/third-party/third-party-comic-sync.type'
import type { ThirdPartyRateLimitCause } from '@libs/content/work/third-party/third-party-rate-limit.type'
import type {
  WorkflowExecuteContext,
  WorkflowHandler,
  WorkflowRetryContext,
} from '@libs/platform/modules/workflow/workflow.type'
import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import { RemoteImageImportService } from '@libs/content/work/third-party/services/remote-image-import.service'
import { readThirdPartyRateLimit } from '@libs/content/work/third-party/third-party-rate-limit'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  WorkflowAttemptStatusEnum,
  WorkflowEventTypeEnum,
} from '@libs/platform/modules/workflow/workflow.constant'
import {
  isWorkflowCancellationError,
  WorkflowCancellationError,
} from '@libs/platform/modules/workflow/workflow-cancellation'
import { WorkflowRegistry } from '@libs/platform/modules/workflow/workflow.registry'
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
      if (isWorkflowCancellationError(error)) {
        await this.throwCancelledAttempt(context, '章节同步已取消', error)
      }
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
      await this.updateTaskProgress(context, counters, '章节同步准备失败')
      await context.assertStillOwned()
      await context.completeAttempt({
        status: WorkflowAttemptStatusEnum.FAILED,
        successItemCount: counters.successItemCount,
        failedItemCount: counters.failedItemCount,
        skippedItemCount: 0,
        errorCode: 'THIRD_PARTY_SYNC_PREPARE_FAILED',
        errorMessage: this.stringifyError(error),
      })
      return
    }

    for (const item of items) {
      try {
        await context.assertNotCancelled()
      } catch (error) {
        if (isWorkflowCancellationError(error)) {
          await this.throwCancelledAttempt(context, '章节同步已取消', error)
        }
        throw error
      }
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
        const result = await this.syncService.importWorkflowSyncChapter({
          context: itemContext,
          plan,
          sourceBindingId: target.sourceBindingId,
          work: target.work,
        })
        await context.assertStillOwned()
        await this.contentImportService.markItemSuccess({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          localChapterId: result.localChapterId,
          imageTotal: result.imageTotal,
          imageSuccessCount: result.imageSuccessCount,
        })
        await itemContext.markUploadedResiduesCleaned()
        await context.assertStillOwned()
        await context.appendEvent(
          WorkflowEventTypeEnum.ITEM_SUCCEEDED,
          `章节「${plan.title}」同步成功`,
          { itemId: item.itemId, providerChapterId: plan.providerChapterId },
        )
        await this.refreshTaskProgress(context, '章节同步进度已更新')
      } catch (error) {
        let errorMessage = this.stringifyError(error)
        try {
          await this.syncService.rollbackSyncTask(itemContext)
        } catch (rollbackError) {
          errorMessage = `${errorMessage}; cleanup=${this.stringifyError(
            rollbackError,
          )}`
        }
        if (isWorkflowCancellationError(error)) {
          await this.throwCancelledAttempt(context, '章节同步已取消', error)
        }
        await context.assertStillOwned()
        const rateLimit = readThirdPartyRateLimit(error)
        if (rateLimit && this.canScheduleAutoRetry(item)) {
          const nextRetryAt = this.resolveNextRetryAt(rateLimit)
          await this.contentImportService.markItemRateLimitRetrying({
            itemId: item.itemId,
            attemptNo: context.attemptNo,
            nextRetryAt,
            errorCode: this.resolveRateLimitCode(rateLimit),
            errorMessage,
            retryReason: rateLimit.reason,
            imageTotal: plan.imageTotal,
            imageSuccessCount: 0,
          })
          await context.appendEvent(
            WorkflowEventTypeEnum.ITEM_FAILED,
            `章节「${plan.title}」遇到限流，已安排自动重试`,
            {
              itemId: item.itemId,
              providerChapterId: plan.providerChapterId,
              nextRetryAt: nextRetryAt.toISOString(),
              errorMessage,
            },
          )
          await this.refreshTaskProgress(context, '章节同步进度已更新')
          continue
        }
        if (rateLimit) {
          await this.contentImportService.markItemRetryExhausted({
            itemId: item.itemId,
            attemptNo: context.attemptNo,
            errorMessage,
            imageTotal: plan.imageTotal,
            imageSuccessCount: 0,
          })
          await context.appendEvent(
            WorkflowEventTypeEnum.ITEM_FAILED,
            `章节「${plan.title}」限流自动重试已耗尽，已跳过自动重试`,
            {
              itemId: item.itemId,
              providerChapterId: plan.providerChapterId,
              errorMessage,
            },
          )
          await this.refreshTaskProgress(context, '章节同步进度已更新')
          continue
        }
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
        await this.refreshTaskProgress(context, '章节同步进度已更新')
      }
    }

    const counters = await this.contentImportService.aggregateJobWithRetryState(
      context.jobId,
    )
    await context.assertStillOwned()
    await this.completeAttempt(context, counters)
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

  // 判断条目是否仍允许由限流分支预约自动重试。
  private canScheduleAutoRetry(item: ContentImportExecutableItem) {
    return (item.autoRetryCount ?? 0) < (item.maxAutoRetries ?? 3)
  }

  // 解析限流建议的下一次执行时间，缺失或非法时使用最小等待窗口。
  private resolveNextRetryAt(rateLimit: ThirdPartyRateLimitCause) {
    if (rateLimit.retryAt) {
      const retryAt = new Date(rateLimit.retryAt)
      if (!Number.isNaN(retryAt.getTime())) {
        return retryAt
      }
    }
    return new Date(Date.now() + Math.max(60_000, rateLimit.retryAfterMs ?? 0))
  }

  // 将限流来源转换为 workflow item 可持久化的错误码。
  private resolveRateLimitCode(rateLimit: ThirdPartyRateLimitCause) {
    return rateLimit.status ? `HTTP_${rateLimit.status}` : 'THIRD_PARTY_RATE_LIMIT'
  }

  // 汇总 item 执行结果，决定本次 workflow attempt 的终态。
  private resolveAttemptStatus(counters: {
    failedItemCount: number
    successItemCount: number
  }) {
    if (counters.failedItemCount === 0) {
      return WorkflowAttemptStatusEnum.SUCCESS
    }
    return counters.successItemCount > 0
      ? WorkflowAttemptStatusEnum.PARTIAL_FAILED
      : WorkflowAttemptStatusEnum.FAILED
  }

  // 根据是否存在延迟重试条目选择立即完成或预约下一轮 attempt。
  private async completeAttempt(
    context: WorkflowExecuteContext,
    counters: ContentImportAttemptCountersWithRetry,
  ) {
    const status = this.resolveAttemptStatus(counters)
    if (counters.futureRetryItemCount > 0 && counters.nextRetryAt) {
      await context.completeAttemptWithDelayedRetry({
        status,
        successItemCount: counters.successItemCount,
        failedItemCount: counters.failedItemCount,
        skippedItemCount: counters.skippedItemCount,
        nextRetryAt: counters.nextRetryAt,
        delayedSelectedItemCount: counters.futureRetryItemCount,
      })
      return
    }
    await context.completeAttempt({
      status,
      successItemCount: counters.successItemCount,
      failedItemCount: counters.failedItemCount,
      skippedItemCount: counters.skippedItemCount,
    })
  }

  // 用 item 终态数刷新 workflow 任务级进度，避免图片级子进度污染全局百分比。
  private async refreshTaskProgress(
    context: WorkflowExecuteContext,
    progressPrefix: string,
  ) {
    const counters = await this.contentImportService.aggregateJobWithRetryState(
      context.jobId,
    )
    await this.updateTaskProgress(context, counters, progressPrefix)
  }

  // 刷新任务级进度，保持图片子进度和任务终态计数分离。
  private async updateTaskProgress(
    context: WorkflowExecuteContext,
    counters: ContentImportAttemptCounters,
    progressPrefix: string,
  ) {
    await context.updateProgress({
      percent: this.resolveTaskProgressPercent(counters),
      message: this.resolveTaskProgressMessage(counters, progressPrefix),
    })
  }

  // 取消中断时刷新任务进度，并携带真实计数交给 workflow 聚合终态。
  private async throwCancelledAttempt(
    context: WorkflowExecuteContext,
    progressPrefix: string,
    cause: unknown,
  ): Promise<never> {
    await context.assertStillOwned()
    const counters = await this.contentImportService.aggregateJob(context.jobId)
    await this.updateTaskProgress(context, counters, progressPrefix)
    await context.assertStillOwned()
    throw new WorkflowCancellationError({ counters, cause })
  }

  private resolveTaskProgressPercent(counters: ContentImportAttemptCounters) {
    const selectedItemCount = Math.max(0, counters.selectedItemCount ?? 0)
    if (selectedItemCount === 0) {
      return 0
    }
    const completedItemCount =
      counters.successItemCount +
      counters.failedItemCount +
      counters.skippedItemCount
    return Math.floor((Math.max(0, completedItemCount) * 100) / selectedItemCount)
  }

  private resolveTaskProgressMessage(
    counters: ContentImportAttemptCounters,
    progressPrefix: string,
  ) {
    const selectedItemCount = Math.max(0, counters.selectedItemCount ?? 0)
    const completedItemCount =
      counters.successItemCount +
      counters.failedItemCount +
      counters.skippedItemCount
    return `${progressPrefix}: ${Math.min(
      selectedItemCount,
      completedItemCount,
    )}/${selectedItemCount}`
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
