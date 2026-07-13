import type { DbExecutor, DbTransaction } from '@db/core'
import type {
  ContentImportItemAttemptSelect,
  ContentImportItemSelect,
  ContentImportJobSelect,
  WorkflowAttemptSelect,
  WorkflowJobSelect,
} from '@db/schema'
import type { ThirdPartyComicSyncChapterPlan } from '@libs/content/work/third-party/third-party-comic-sync.type'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type { WorkflowItemPageRequestDto } from '@libs/platform/modules/workflow/dto'
import type { SQL } from 'drizzle-orm'
import type {
  ContentImportAttemptCounters,
  ContentImportAttemptCountersWithRetry,
  ContentImportExecutableItem,
  ContentImportMarkItemFailedInput,
  ContentImportMarkItemImageProgressInput,
  ContentImportMarkItemRateLimitRetryingInput,
  ContentImportMarkItemRetryExhaustedInput,
  ContentImportMarkItemSuccessInput,
  ContentImportPreparedThirdPartyImportTargetInput,
  ContentImportRecordUploadedFileResidueInput,
  CreateThirdPartyImportContentJobInput,
  CreateThirdPartySyncContentJobInput,
} from './content-import.type'
import { randomUUID } from 'node:crypto'
import {
  acquireIntegrityLocks,
  DrizzleService,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { workCatalogWorkLock } from '@libs/content/work/core/work-integrity-lock'
import { resolveThirdPartyComicImportImageTotals } from '@libs/content/work/third-party/third-party-comic-import-image-total'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  createWorkflowErrorFactsByCode,
  toWorkflowErrorColumns,
  toWorkflowLastErrorColumns,
  toWorkflowLastErrorView,
  toWorkflowRetryColumns,
  toWorkflowRetryView,
  WorkflowErrorCodeEnum,
} from '@libs/platform/modules/workflow/workflow-error-facts'
import { WorkflowItemStatusEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import {
  ContentImportContentTypeEnum,
  ContentImportItemAttemptStatusEnum,
  ContentImportItemStageEnum,
  ContentImportItemStatusEnum,
  ContentImportItemTypeEnum,
  ContentImportPublishBoundaryStatusEnum,
  ContentImportResidueCleanupStatusEnum,
  ContentImportResidueTypeEnum,
  ContentImportSourceTypeEnum,
} from './content-import.constant'
import { ContentImportItemPageRequestDto } from './dto/content-import.dto'

interface ContentImportJobContext {
  importJob: ContentImportJobSelect
  workflowJob: WorkflowJobSelect
}

interface ContentImportItemContext extends ContentImportJobContext {
  item: ContentImportItemSelect
}

interface CurrentContentImportItemAttemptContext extends ContentImportItemContext {
  itemAttempt: ContentImportItemAttemptSelect
  workflowAttempt: WorkflowAttemptSelect
}

type ContentImportAggregateItem = Pick<
  ContentImportItemSelect,
  'imageSuccessCount' | 'imageTotal' | 'status'
>

type ContentImportAggregateItemWithRetryState = ContentImportAggregateItem &
  Pick<ContentImportItemSelect, 'nextRetryAt'>

type ContentImportItemAttemptIdSnapshot = Pick<
  ContentImportItemAttemptSelect,
  'id'
>

type WorkflowAttemptIdSnapshot = Pick<WorkflowAttemptSelect, 'id'>

type WorkflowAttemptIdentitySnapshot = Pick<
  WorkflowAttemptSelect,
  'attemptNo' | 'id' | 'workflowJobId'
>

type WorkflowJobIdSnapshot = Pick<WorkflowJobSelect, 'id'>

interface ContentImportImageCounterPatch {
  imageSuccessCount?: number
  imageTotal?: number
}

interface ContentImportItemAttemptMutationInput {
  attemptNo: number
  itemId: string
}

/**
 * 内容导入领域服务。
 * 维护 workflow 之外的内容任务、章节条目、条目 attempt 与重试状态。
 */
@Injectable()
export class ContentImportService {
  // 初始化内容导入领域服务依赖。
  constructor(private readonly drizzle: DrizzleService) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 workflowJob。
  private get workflowJob() {
    return this.drizzle.schema.workflowJob
  }

  // 读取 workflowAttempt。
  private get workflowAttempt() {
    return this.drizzle.schema.workflowAttempt
  }

  // 读取 contentImportJob。
  private get contentImportJob() {
    return this.drizzle.schema.contentImportJob
  }

  // 读取 contentImportItem。
  private get contentImportItem() {
    return this.drizzle.schema.contentImportItem
  }

  // 管理端条目与 workflow 通用条目页共用的稳定读模型；诊断与 attempt 内部字段不进入分页链。
  private get contentImportItemPageSelect() {
    return {
      id: this.contentImportItem.id,
      itemId: this.contentImportItem.itemId,
      itemType: this.contentImportItem.itemType,
      providerChapterId: this.contentImportItem.providerChapterId,
      localChapterId: this.contentImportItem.localChapterId,
      title: this.contentImportItem.title,
      sortOrder: this.contentImportItem.sortOrder,
      status: this.contentImportItem.status,
      stage: this.contentImportItem.stage,
      failureCount: this.contentImportItem.failureCount,
      lastErrorCode: this.contentImportItem.lastErrorCode,
      lastErrorDomain: this.contentImportItem.lastErrorDomain,
      lastErrorStage: this.contentImportItem.lastErrorStage,
      lastErrorSeverity: this.contentImportItem.lastErrorSeverity,
      lastErrorRetryable: this.contentImportItem.lastErrorRetryable,
      lastErrorContext: this.contentImportItem.lastErrorContext,
      nextRetryAt: this.contentImportItem.nextRetryAt,
      autoRetryCount: this.contentImportItem.autoRetryCount,
      maxAutoRetries: this.contentImportItem.maxAutoRetries,
      lastRetryCode: this.contentImportItem.lastRetryCode,
      lastRetryContext: this.contentImportItem.lastRetryContext,
      imageTotal: this.contentImportItem.imageTotal,
      imageSuccessCount: this.contentImportItem.imageSuccessCount,
      metadata: this.contentImportItem.metadata,
      updatedAt: this.contentImportItem.updatedAt,
    }
  }

  // 读取 contentImportItemAttempt。
  private get contentImportItemAttempt() {
    return this.drizzle.schema.contentImportItemAttempt
  }

  // 读取 contentImportResidue。
  private get contentImportResidue() {
    return this.drizzle.schema.contentImportResidue
  }

  // 读取 work。
  private get work() {
    return this.drizzle.schema.work
  }

  // 在创建 workflow 草稿的同一事务内创建三方导入领域任务和章节条目。
  async createThirdPartyImportJobWithDb(
    tx: DbTransaction,
    workflowJob: WorkflowJobSelect,
    input: CreateThirdPartyImportContentJobInput,
  ) {
    this.assertWorkflowJobIdentity(workflowJob, input.jobId)
    const chapterImageTotals = resolveThirdPartyComicImportImageTotals(
      input.dto.chapters,
    )
    const imageTotal = chapterImageTotals.reduce((sum, total) => sum + total, 0)
    const now = new Date()
    const providerGroupPathWord =
      input.dto.sourceSnapshot.providerGroupPathWord ??
      input.dto.chapters.at(0)?.group ??
      null
    const [job] = await tx
      .insert(this.contentImportJob)
      .values({
        workflowJobId: workflowJob.id,
        contentType: ContentImportContentTypeEnum.COMIC,
        sourceType: ContentImportSourceTypeEnum.THIRD_PARTY_IMPORT,
        workId: input.dto.targetWorkId ?? null,
        platform: input.dto.platform,
        providerComicId: input.dto.sourceSnapshot.providerComicId,
        providerPathWord: input.dto.sourceSnapshot.providerPathWord,
        providerGroupPathWord,
        sourceSnapshot: input.dto,
        publishBoundaryStatus:
          ContentImportPublishBoundaryStatusEnum.NEEDS_MANUAL_REVIEW,
        selectedItemCount: input.dto.chapters.length,
        imageTotal,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (input.dto.chapters.length > 0) {
      await tx.insert(this.contentImportItem).values(
        input.dto.chapters.map((chapter, index) => ({
          itemId: randomUUID(),
          contentImportJobId: job.id,
          itemType: ContentImportItemTypeEnum.COMIC_CHAPTER,
          providerChapterId: chapter.providerChapterId,
          targetChapterId: chapter.targetChapterId ?? null,
          localChapterId: chapter.targetChapterId ?? null,
          title: chapter.title,
          sortOrder: chapter.sortOrder,
          status: ContentImportItemStatusEnum.PENDING,
          stage: ContentImportItemStageEnum.READING_SOURCE,
          failureCount: 0,
          ...toWorkflowLastErrorColumns(null),
          lastFailedAt: null,
          nextRetryAt: null,
          autoRetryCount: 0,
          maxAutoRetries: 3,
          ...toWorkflowRetryColumns(null),
          imageTotal: chapterImageTotals[index] ?? 0,
          imageSuccessCount: 0,
          currentAttemptNo: null,
          metadata: { chapter },
          createdAt: now,
          updatedAt: now,
        })),
      )
    }

    return job
  }

  // 在创建 workflow 草稿的同一事务内创建三方同步领域任务，章节条目由执行期扫描后补齐。
  async createThirdPartySyncJobWithDb(
    tx: DbTransaction,
    workflowJob: WorkflowJobSelect,
    input: CreateThirdPartySyncContentJobInput,
  ) {
    this.assertWorkflowJobIdentity(workflowJob, input.jobId)
    const now = new Date()
    const [job] = await tx
      .insert(this.contentImportJob)
      .values({
        workflowJobId: workflowJob.id,
        contentType: ContentImportContentTypeEnum.COMIC,
        sourceType: ContentImportSourceTypeEnum.THIRD_PARTY_SYNC,
        workId: input.source.workId,
        platform: input.source.platform,
        providerComicId: input.source.providerComicId,
        providerPathWord: input.source.providerPathWord,
        providerGroupPathWord: input.source.providerGroupPathWord,
        sourceSnapshot: {
          request: input.dto,
          source: input.source,
        },
        publishBoundaryStatus:
          ContentImportPublishBoundaryStatusEnum.NEEDS_MANUAL_REVIEW,
        selectedItemCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    return job
  }

  // 用执行期扫描出的最新章节计划重建三方同步条目。
  async replaceThirdPartySyncItems(
    jobId: string,
    attemptId: string,
    plans: ThirdPartyComicSyncChapterPlan[],
  ) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const located = await this.requireWorkflowImportJobContext(jobId, tx)
        const locatedAttempt = await this.readWorkflowAttempt(attemptId, tx)
        this.assertWorkflowAttemptBelongsToJob(
          locatedAttempt,
          located.workflowJob,
        )
        await acquireIntegrityLocks(tx, [
          tableIntegrityLock('workflow_job', located.workflowJob.id),
          tableIntegrityLock('workflow_attempt', locatedAttempt.id),
          tableIntegrityLock('content_import_job', located.importJob.id),
        ])

        const context = await this.requireWorkflowImportJobContext(jobId, tx)
        const workflowAttempt = await this.readWorkflowAttempt(attemptId, tx)
        this.assertWorkflowAttemptBelongsToJob(
          workflowAttempt,
          context.workflowJob,
        )

        const now = new Date()
        const existingItems = await tx
          .select({ id: this.contentImportItem.id })
          .from(this.contentImportItem)
          .where(
            eq(this.contentImportItem.contentImportJobId, context.importJob.id),
          )
        const existingItemIds = existingItems.map((item) => item.id)
        if (existingItemIds.length > 0) {
          const [itemAttempt] = await tx
            .select({ id: this.contentImportItemAttempt.id })
            .from(this.contentImportItemAttempt)
            .where(
              inArray(
                this.contentImportItemAttempt.contentImportItemId,
                existingItemIds,
              ),
            )
            .limit(1)
          const [residue] = await tx
            .select({ id: this.contentImportResidue.id })
            .from(this.contentImportResidue)
            .where(
              inArray(
                this.contentImportResidue.contentImportItemId,
                existingItemIds,
              ),
            )
            .limit(1)
          if (itemAttempt || residue) {
            throw new BusinessException(
              BusinessErrorCode.STATE_CONFLICT,
              '存在已执行或待清理的导入条目，不能重建同步计划',
            )
          }
        }
        await tx
          .delete(this.contentImportItem)
          .where(
            eq(this.contentImportItem.contentImportJobId, context.importJob.id),
          )
        if (plans.length > 0) {
          await tx.insert(this.contentImportItem).values(
            plans.map((plan) => ({
              itemId: randomUUID(),
              contentImportJobId: context.importJob.id,
              itemType: ContentImportItemTypeEnum.COMIC_CHAPTER,
              providerChapterId: plan.providerChapterId,
              targetChapterId: null,
              localChapterId: null,
              title: plan.title,
              sortOrder: plan.localSortOrder,
              status: ContentImportItemStatusEnum.PENDING,
              stage: ContentImportItemStageEnum.READING_SOURCE,
              failureCount: 0,
              ...toWorkflowLastErrorColumns(null),
              lastFailedAt: null,
              nextRetryAt: null,
              autoRetryCount: 0,
              maxAutoRetries: 3,
              ...toWorkflowRetryColumns(null),
              imageTotal: plan.imageTotal,
              imageSuccessCount: 0,
              currentAttemptNo: null,
              metadata: { plan },
              createdAt: now,
              updatedAt: now,
            })),
          )
        }
        await tx
          .update(this.contentImportJob)
          .set({
            selectedItemCount: plans.length,
            imageTotal: plans.reduce((sum, plan) => sum + plan.imageTotal, 0),
            updatedAt: now,
          })
          .where(eq(this.contentImportJob.id, context.importJob.id))
        await tx
          .update(this.workflowJob)
          .set({
            selectedItemCount: plans.length,
            updatedAt: now,
          })
          .where(eq(this.workflowJob.id, context.workflowJob.id))
        await tx
          .update(this.workflowAttempt)
          .set({
            selectedItemCount: plans.length,
            updatedAt: now,
          })
          .where(eq(this.workflowAttempt.id, workflowAttempt.id))
      },
    })
  }

  // 记录三方导入首次 prepare 生成的本地作品，供后续自动重试 attempt 复用。
  async markThirdPartyImportTargetPrepared(
    input: ContentImportPreparedThirdPartyImportTargetInput,
  ) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const located = await this.requireWorkflowImportJobContext(
          input.jobId,
          tx,
        )
        await acquireIntegrityLocks(tx, [
          tableIntegrityLock('workflow_job', located.workflowJob.id),
          tableIntegrityLock('content_import_job', located.importJob.id),
          workCatalogWorkLock(input.workId),
        ])
        const context = await this.requireWorkflowImportJobContext(
          input.jobId,
          tx,
        )
        const [work] = await tx
          .select({ id: this.work.id })
          .from(this.work)
          .where(
            and(eq(this.work.id, input.workId), isNull(this.work.deletedAt)),
          )
          .limit(1)
        if (!work) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '导入目标作品不存在',
          )
        }
        await tx
          .update(this.contentImportJob)
          .set({
            workId: input.workId,
            updatedAt: new Date(),
          })
          .where(eq(this.contentImportJob.id, context.importJob.id))
      },
    })
  }

  // 校验并准备人工重试条目。
  async prepareRetryItems(
    jobId: string,
    selectedItemIds: string[],
    nextAttemptNo: number,
    tx: DbTransaction,
  ) {
    const located = await this.requireWorkflowImportJobContext(jobId, tx)
    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('workflow_job', located.workflowJob.id),
      tableIntegrityLock('content_import_job', located.importJob.id),
    ])
    const context = await this.requireWorkflowImportJobContext(jobId, tx)
    const items = await tx
      .select({ status: this.contentImportItem.status })
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, context.importJob.id),
          inArray(this.contentImportItem.itemId, selectedItemIds),
        ),
      )

    if (items.length !== selectedItemIds.length) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '存在不属于当前工作流任务的导入条目',
      )
    }
    const invalidItem = items.find(
      (item) => item.status !== ContentImportItemStatusEnum.FAILED,
    )
    if (invalidItem) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '只能重试失败的章节条目',
      )
    }

    await tx
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.RETRYING,
        stage: ContentImportItemStageEnum.READING_SOURCE,
        currentAttemptNo: nextAttemptNo,
        nextRetryAt: null,
        autoRetryCount: 0,
        ...toWorkflowRetryColumns(null),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, context.importJob.id),
          inArray(this.contentImportItem.itemId, selectedItemIds),
        ),
      )

    const counters = await this.aggregateJobWithDb(context.importJob.id, tx)
    return {
      jobCounters: this.toWorkflowCounterPatch(counters),
    }
  }

  // 读取当前 attempt 应处理的内容导入条目。
  async listExecutableItems(jobId: string, attemptNo: number) {
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId)
    const now = new Date()
    const statusFilter =
      attemptNo === 1
        ? [
            ContentImportItemStatusEnum.PENDING,
            ContentImportItemStatusEnum.RETRYING,
          ]
        : [ContentImportItemStatusEnum.RETRYING]

    const rows: ContentImportExecutableItem[] = await this.db
      .select({
        itemId: this.contentImportItem.itemId,
        providerChapterId: this.contentImportItem.providerChapterId,
        metadata: this.contentImportItem.metadata,
        autoRetryCount: this.contentImportItem.autoRetryCount,
        maxAutoRetries: this.contentImportItem.maxAutoRetries,
      })
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
          inArray(this.contentImportItem.status, statusFilter),
          or(
            isNull(this.contentImportItem.nextRetryAt),
            lte(this.contentImportItem.nextRetryAt, now),
          ),
          attemptNo === 1
            ? isNull(this.contentImportItem.currentAttemptNo)
            : or(
                eq(this.contentImportItem.currentAttemptNo, attemptNo),
                lte(this.contentImportItem.nextRetryAt, now),
              ),
        ),
      )
      .orderBy(
        asc(this.contentImportItem.sortOrder),
        asc(this.contentImportItem.id),
      )

    return rows
  }

  // 开始处理单个条目，并创建条目 attempt。
  async startItemAttempt(jobId: string, attemptId: string, itemId: string) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const located = await this.requireContentImportItemContextInTransaction(
          tx,
          itemId,
        )
        const locatedAttempt = await this.readWorkflowAttemptInTransaction(
          tx,
          attemptId,
        )
        this.assertWorkflowAttemptBelongsToJob(
          locatedAttempt,
          located.workflowJob,
        )
        await acquireIntegrityLocks(tx, [
          tableIntegrityLock('workflow_job', located.workflowJob.id),
          tableIntegrityLock('workflow_attempt', locatedAttempt.id),
          tableIntegrityLock('content_import_job', located.importJob.id),
          tableIntegrityLock('content_import_item', located.item.id),
        ])

        const context = await this.requireContentImportItemContextInTransaction(
          tx,
          itemId,
        )
        const workflowAttempt = await this.readWorkflowAttemptInTransaction(
          tx,
          attemptId,
        )
        this.assertWorkflowAttemptBelongsToJob(
          workflowAttempt,
          context.workflowJob,
        )
        if (
          context.item.currentAttemptNo !== null &&
          context.item.currentAttemptNo !== workflowAttempt.attemptNo
        ) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '内容导入条目已归属其他执行 attempt',
          )
        }
        const now = new Date()
        const [item] = await tx
          .update(this.contentImportItem)
          .set({
            status: ContentImportItemStatusEnum.RUNNING,
            currentAttemptNo: workflowAttempt.attemptNo,
            updatedAt: now,
          })
          .where(
            and(
              eq(this.contentImportItem.id, context.item.id),
              context.item.currentAttemptNo === null
                ? isNull(this.contentImportItem.currentAttemptNo)
                : eq(
                    this.contentImportItem.currentAttemptNo,
                    workflowAttempt.attemptNo,
                  ),
            ),
          )
          .returning()
        if (!item) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '内容导入条目状态已变更，无法开始处理',
          )
        }

        const [itemAttempt] = await tx
          .insert(this.contentImportItemAttempt)
          .values({
            itemAttemptId: randomUUID(),
            workflowAttemptId: workflowAttempt.id,
            contentImportItemId: item.id,
            attemptNo: workflowAttempt.attemptNo,
            status: ContentImportItemAttemptStatusEnum.RUNNING,
            stage: item.stage,
            imageTotal: item.imageTotal,
            imageSuccessCount: 0,
            ...toWorkflowErrorColumns(null),
            startedAt: now,
            finishedAt: null,
            createdAt: now,
            updatedAt: now,
          })
          .returning()

        return { item, itemAttempt }
      },
    })
  }

  // 标记条目成功。
  async markItemSuccess(input: ContentImportMarkItemSuccessInput) {
    const now = new Date()
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const result = await this.markItemSuccessInTransaction(tx, input, now)
        return result
      },
    })
  }

  // 标记条目失败。
  async markItemFailed(input: ContentImportMarkItemFailedInput) {
    const now = new Date()
    const imageCounters = this.buildImageCounterPatch(input)
    const lastErrorColumns = toWorkflowLastErrorColumns(
      input.error,
      input.errorDiagnostic,
    )
    const attemptErrorColumns = toWorkflowErrorColumns(
      input.error,
      input.errorDiagnostic,
    )
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const result = await this.markItemFailedInTransaction(
          tx,
          input,
          now,
          imageCounters,
          lastErrorColumns,
          attemptErrorColumns,
        )
        return result
      },
    })
  }

  // 标记条目进入限流自动重试等待。
  async markItemRateLimitRetrying(
    input: ContentImportMarkItemRateLimitRetryingInput,
  ) {
    const now = new Date()
    const imageCounters = this.buildImageCounterPatch(input)
    const lastErrorColumns = toWorkflowLastErrorColumns(
      input.error,
      input.errorDiagnostic,
    )
    const retryColumns = toWorkflowRetryColumns(
      input.error,
      input.errorDiagnostic,
    )
    const attemptErrorColumns = toWorkflowErrorColumns(
      input.error,
      input.errorDiagnostic,
    )
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const result = await this.markItemRateLimitRetryingInTransaction(
          tx,
          input,
          now,
          imageCounters,
          lastErrorColumns,
          retryColumns,
          attemptErrorColumns,
        )
        return result
      },
    })
  }

  // 标记限流自动重试耗尽。
  async markItemRetryExhausted(
    input: ContentImportMarkItemRetryExhaustedInput,
  ) {
    const now = new Date()
    const error =
      input.error ??
      createWorkflowErrorFactsByCode(
        WorkflowErrorCodeEnum.CONTENT_IMPORT_RETRY_EXHAUSTED,
        { itemId: input.itemId },
      )
    const lastErrorColumns = toWorkflowLastErrorColumns(
      error,
      input.errorDiagnostic,
    )
    const retryColumns = toWorkflowRetryColumns(error, input.errorDiagnostic)
    const attemptErrorColumns = toWorkflowErrorColumns(
      error,
      input.errorDiagnostic,
    )
    const imageCounters = this.buildImageCounterPatch(input)
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const result = await this.markItemRetryExhaustedInTransaction(
          tx,
          input,
          now,
          imageCounters,
          lastErrorColumns,
          retryColumns,
          attemptErrorColumns,
        )
        return result
      },
    })
  }

  /**
   * 在锁定并重查当前 item attempt 的同一事务内标记成功。
   * 过期 worker 仍保持原有的静默 no-op 语义。
   */
  private async markItemSuccessInTransaction(
    tx: DbTransaction,
    input: ContentImportMarkItemSuccessInput,
    now: Date,
  ) {
    const locatedAttempt =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!locatedAttempt) {
      return
    }
    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('workflow_job', locatedAttempt.workflowJob.id),
      tableIntegrityLock('workflow_attempt', locatedAttempt.workflowAttempt.id),
      tableIntegrityLock('content_import_job', locatedAttempt.importJob.id),
      tableIntegrityLock('content_import_item', locatedAttempt.item.id),
      tableIntegrityLock(
        'content_import_item_attempt',
        locatedAttempt.itemAttempt.id,
      ),
    ])
    const context =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!context) {
      return
    }
    const imageCounters = this.buildImageCounterPatch(input)
    const [item] = await tx
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.SUCCESS,
        stage: ContentImportItemStageEnum.DONE,
        localChapterId: input.localChapterId ?? undefined,
        ...imageCounters,
        ...toWorkflowLastErrorColumns(null),
        lastFailedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.contentImportItem.id, context.item.id),
          eq(this.contentImportItem.currentAttemptNo, input.attemptNo),
        ),
      )
      .returning()
    if (!item) {
      return
    }
    const [itemAttempt] = await tx
      .update(this.contentImportItemAttempt)
      .set({
        status: ContentImportItemAttemptStatusEnum.SUCCESS,
        stage: ContentImportItemStageEnum.DONE,
        ...imageCounters,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(this.contentImportItemAttempt.id, context.itemAttempt.id))
      .returning({ id: this.contentImportItemAttempt.id })
    this.assertItemAttemptUpdated(itemAttempt)
  }

  /** 在锁定并重查当前 item attempt 的同一事务内标记失败。 */
  private async markItemFailedInTransaction(
    tx: DbTransaction,
    input: ContentImportMarkItemFailedInput,
    now: Date,
    imageCounters: ContentImportImageCounterPatch,
    lastErrorColumns: ReturnType<typeof toWorkflowLastErrorColumns>,
    attemptErrorColumns: ReturnType<typeof toWorkflowErrorColumns>,
  ) {
    const locatedAttempt =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!locatedAttempt) {
      return
    }
    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('workflow_job', locatedAttempt.workflowJob.id),
      tableIntegrityLock('workflow_attempt', locatedAttempt.workflowAttempt.id),
      tableIntegrityLock('content_import_job', locatedAttempt.importJob.id),
      tableIntegrityLock('content_import_item', locatedAttempt.item.id),
      tableIntegrityLock(
        'content_import_item_attempt',
        locatedAttempt.itemAttempt.id,
      ),
    ])
    const context =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!context) {
      return
    }
    const [item] = await tx
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.FAILED,
        stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
        failureCount: sql`${this.contentImportItem.failureCount} + 1`,
        ...lastErrorColumns,
        lastFailedAt: now,
        nextRetryAt: null,
        ...imageCounters,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.contentImportItem.id, context.item.id),
          eq(this.contentImportItem.currentAttemptNo, input.attemptNo),
        ),
      )
      .returning()
    if (!item) {
      return
    }
    const [itemAttempt] = await tx
      .update(this.contentImportItemAttempt)
      .set({
        status: ContentImportItemAttemptStatusEnum.FAILED,
        stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
        ...imageCounters,
        ...attemptErrorColumns,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(this.contentImportItemAttempt.id, context.itemAttempt.id))
      .returning({ id: this.contentImportItemAttempt.id })
    this.assertItemAttemptUpdated(itemAttempt)
  }

  /** 在锁定并重查当前 item attempt 的同一事务内安排限流自动重试。 */
  private async markItemRateLimitRetryingInTransaction(
    tx: DbTransaction,
    input: ContentImportMarkItemRateLimitRetryingInput,
    now: Date,
    imageCounters: ContentImportImageCounterPatch,
    lastErrorColumns: ReturnType<typeof toWorkflowLastErrorColumns>,
    retryColumns: ReturnType<typeof toWorkflowRetryColumns>,
    attemptErrorColumns: ReturnType<typeof toWorkflowErrorColumns>,
  ) {
    const locatedAttempt =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!locatedAttempt) {
      return
    }
    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('workflow_job', locatedAttempt.workflowJob.id),
      tableIntegrityLock('workflow_attempt', locatedAttempt.workflowAttempt.id),
      tableIntegrityLock('content_import_job', locatedAttempt.importJob.id),
      tableIntegrityLock('content_import_item', locatedAttempt.item.id),
      tableIntegrityLock(
        'content_import_item_attempt',
        locatedAttempt.itemAttempt.id,
      ),
    ])
    const context =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!context) {
      return
    }
    const [item] = await tx
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.RETRYING,
        stage: ContentImportItemStageEnum.READING_SOURCE,
        autoRetryCount: sql`${this.contentImportItem.autoRetryCount} + 1`,
        ...lastErrorColumns,
        lastFailedAt: now,
        nextRetryAt: input.nextRetryAt,
        ...retryColumns,
        ...imageCounters,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.contentImportItem.id, context.item.id),
          eq(this.contentImportItem.currentAttemptNo, input.attemptNo),
        ),
      )
      .returning()
    if (!item) {
      return
    }
    const [itemAttempt] = await tx
      .update(this.contentImportItemAttempt)
      .set({
        status: ContentImportItemAttemptStatusEnum.SCHEDULED_RETRY,
        stage: ContentImportItemStageEnum.READING_SOURCE,
        ...imageCounters,
        ...attemptErrorColumns,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(this.contentImportItemAttempt.id, context.itemAttempt.id))
      .returning({ id: this.contentImportItemAttempt.id })
    this.assertItemAttemptUpdated(itemAttempt)
  }

  /** 在锁定并重查当前 item attempt 的同一事务内写入重试耗尽状态。 */
  private async markItemRetryExhaustedInTransaction(
    tx: DbTransaction,
    input: ContentImportMarkItemRetryExhaustedInput,
    now: Date,
    imageCounters: ContentImportImageCounterPatch,
    lastErrorColumns: ReturnType<typeof toWorkflowLastErrorColumns>,
    retryColumns: ReturnType<typeof toWorkflowRetryColumns>,
    attemptErrorColumns: ReturnType<typeof toWorkflowErrorColumns>,
  ) {
    const locatedAttempt =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!locatedAttempt) {
      return
    }
    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('workflow_job', locatedAttempt.workflowJob.id),
      tableIntegrityLock('workflow_attempt', locatedAttempt.workflowAttempt.id),
      tableIntegrityLock('content_import_job', locatedAttempt.importJob.id),
      tableIntegrityLock('content_import_item', locatedAttempt.item.id),
      tableIntegrityLock(
        'content_import_item_attempt',
        locatedAttempt.itemAttempt.id,
      ),
    ])
    const context =
      await this.findCurrentItemAttemptContextForMutationInTransaction(
        tx,
        input,
      )
    if (!context) {
      return
    }
    const [item] = await tx
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.FAILED,
        stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
        failureCount: sql`${this.contentImportItem.failureCount} + 1`,
        ...lastErrorColumns,
        lastFailedAt: now,
        nextRetryAt: null,
        ...retryColumns,
        ...imageCounters,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.contentImportItem.id, context.item.id),
          eq(this.contentImportItem.currentAttemptNo, input.attemptNo),
        ),
      )
      .returning()
    if (!item) {
      return
    }
    const [itemAttempt] = await tx
      .update(this.contentImportItemAttempt)
      .set({
        status: ContentImportItemAttemptStatusEnum.FAILED,
        stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
        ...imageCounters,
        ...attemptErrorColumns,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(this.contentImportItemAttempt.id, context.itemAttempt.id))
      .returning({ id: this.contentImportItemAttempt.id })
    this.assertItemAttemptUpdated(itemAttempt)
  }

  // 持久化单个条目的图片级进度，并返回任务级聚合计数。
  async markItemImageProgress(input: ContentImportMarkItemImageProgressInput) {
    const imageTotal = this.normalizeImageCount(input.imageTotal)
    const imageSuccessCount = Math.min(
      imageTotal,
      this.normalizeImageCount(input.imageSuccessCount),
    )
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const located = await this.requireContentImportItemContextInTransaction(
          tx,
          input.itemId,
        )
        const locatedAttempt =
          located.item.currentAttemptNo === null
            ? null
            : await this.findCurrentItemAttemptContextForMutationInTransaction(
                tx,
                {
                  attemptNo: located.item.currentAttemptNo,
                  itemId: input.itemId,
                },
              )
        if (located.item.currentAttemptNo !== null && !locatedAttempt) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '内容导入条目 attempt 不存在或已失效',
          )
        }
        await acquireIntegrityLocks(tx, [
          tableIntegrityLock('workflow_job', located.workflowJob.id),
          tableIntegrityLock('content_import_job', located.importJob.id),
          tableIntegrityLock('content_import_item', located.item.id),
          ...(locatedAttempt
            ? [
                tableIntegrityLock(
                  'workflow_attempt',
                  locatedAttempt.workflowAttempt.id,
                ),
                tableIntegrityLock(
                  'content_import_item_attempt',
                  locatedAttempt.itemAttempt.id,
                ),
              ]
            : []),
        ])

        const context = await this.requireContentImportItemContextInTransaction(
          tx,
          input.itemId,
        )
        if (context.item.currentAttemptNo !== located.item.currentAttemptNo) {
          return
        }
        const now = new Date()
        const [item] = await tx
          .update(this.contentImportItem)
          .set({
            imageTotal,
            imageSuccessCount,
            updatedAt: now,
          })
          .where(
            and(
              eq(this.contentImportItem.id, context.item.id),
              context.item.currentAttemptNo === null
                ? isNull(this.contentImportItem.currentAttemptNo)
                : eq(
                    this.contentImportItem.currentAttemptNo,
                    context.item.currentAttemptNo,
                  ),
            ),
          )
          .returning()
        if (!item) {
          return
        }
        if (locatedAttempt) {
          const currentAttempt =
            await this.findCurrentItemAttemptContextForMutationInTransaction(
              tx,
              {
                attemptNo: locatedAttempt.workflowAttempt.attemptNo,
                itemId: input.itemId,
              },
            )
          if (!currentAttempt) {
            throw new BusinessException(
              BusinessErrorCode.STATE_CONFLICT,
              '内容导入条目 attempt 不存在或已失效',
            )
          }
          const [itemAttempt] = await tx
            .update(this.contentImportItemAttempt)
            .set({
              imageTotal,
              imageSuccessCount,
              updatedAt: now,
            })
            .where(
              eq(
                this.contentImportItemAttempt.id,
                currentAttempt.itemAttempt.id,
              ),
            )
            .returning({ id: this.contentImportItemAttempt.id })
          this.assertItemAttemptUpdated(itemAttempt)
        }
        return this.aggregateJobWithDb(item.contentImportJobId, tx)
      },
    })
  }

  // 聚合内容导入任务计数。
  async aggregateJob(jobId: string) {
    return this.withLockedWorkflowImportJob(jobId, async (tx, context) => {
      const rows = await tx
        .select({
          status: this.contentImportItem.status,
          imageTotal: this.contentImportItem.imageTotal,
          imageSuccessCount: this.contentImportItem.imageSuccessCount,
        })
        .from(this.contentImportItem)
        .where(
          eq(this.contentImportItem.contentImportJobId, context.importJob.id),
        )
      return this.aggregateRows(context.importJob.id, rows, tx)
    })
  }

  // 聚合指定 workflow attempt 内实际处理过的条目计数。
  async aggregateAttempt(jobId: string, attemptNo: number) {
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId)
    const rows = await this.db
      .select({
        attempt: this.contentImportItemAttempt,
        item: this.contentImportItem,
      })
      .from(this.contentImportItemAttempt)
      .innerJoin(
        this.contentImportItem,
        eq(
          this.contentImportItemAttempt.contentImportItemId,
          this.contentImportItem.id,
        ),
      )
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
          eq(this.contentImportItemAttempt.attemptNo, attemptNo),
        ),
      )
    return this.aggregateAttemptRows(rows.map((row) => row.attempt))
  }

  // 聚合内容导入任务计数，并返回未来自动重试状态。
  async aggregateJobWithRetryState(
    jobId: string,
  ): Promise<ContentImportAttemptCountersWithRetry> {
    return this.withLockedWorkflowImportJob(jobId, async (tx, context) => {
      const rows = await tx
        .select({
          status: this.contentImportItem.status,
          imageTotal: this.contentImportItem.imageTotal,
          imageSuccessCount: this.contentImportItem.imageSuccessCount,
          nextRetryAt: this.contentImportItem.nextRetryAt,
        })
        .from(this.contentImportItem)
        .where(
          eq(this.contentImportItem.contentImportJobId, context.importJob.id),
        )
      return this.aggregateRowsWithRetryState(context.importJob.id, rows, tx)
    })
  }

  // 记录已上传文件残留，供失败补偿和崩溃后清理使用。
  async recordUploadedFileResidue(
    input: ContentImportRecordUploadedFileResidueInput,
  ) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const locatedJob = await this.requireWorkflowImportJobContext(
          input.jobId,
          tx,
        )
        const locatedWorkflowAttempt = input.attemptId
          ? await this.readWorkflowAttempt(input.attemptId, tx)
          : null
        const locatedItem = input.itemId
          ? await this.requireContentImportItemContext(input.itemId, tx)
          : null
        if (locatedWorkflowAttempt) {
          this.assertWorkflowAttemptBelongsToJob(
            locatedWorkflowAttempt,
            locatedJob.workflowJob,
          )
        }
        if (
          locatedItem &&
          (locatedItem.workflowJob.id !== locatedJob.workflowJob.id ||
            locatedItem.importJob.id !== locatedJob.importJob.id)
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '内容导入条目不属于当前工作流任务',
          )
        }
        const locatedItemAttempt =
          locatedItem && locatedWorkflowAttempt
            ? await this.findContentImportItemAttemptByContext(
                locatedItem.item.id,
                locatedWorkflowAttempt.id,
                locatedWorkflowAttempt.attemptNo,
                tx,
              )
            : null
        await acquireIntegrityLocks(tx, [
          tableIntegrityLock('workflow_job', locatedJob.workflowJob.id),
          tableIntegrityLock('content_import_job', locatedJob.importJob.id),
          ...(locatedWorkflowAttempt
            ? [
                tableIntegrityLock(
                  'workflow_attempt',
                  locatedWorkflowAttempt.id,
                ),
              ]
            : []),
          ...(locatedItem
            ? [tableIntegrityLock('content_import_item', locatedItem.item.id)]
            : []),
          ...(locatedItemAttempt
            ? [
                tableIntegrityLock(
                  'content_import_item_attempt',
                  locatedItemAttempt.id,
                ),
              ]
            : []),
        ])

        const context = await this.requireWorkflowImportJobContext(
          input.jobId,
          tx,
        )
        const workflowAttempt = input.attemptId
          ? await this.readWorkflowAttempt(input.attemptId, tx)
          : null
        if (workflowAttempt) {
          this.assertWorkflowAttemptBelongsToJob(
            workflowAttempt,
            context.workflowJob,
          )
        }
        const itemContext = input.itemId
          ? await this.requireContentImportItemContextInTransaction(
              tx,
              input.itemId,
            )
          : null
        if (
          itemContext &&
          (itemContext.workflowJob.id !== context.workflowJob.id ||
            itemContext.importJob.id !== context.importJob.id)
        ) {
          throw new BusinessException(
            BusinessErrorCode.OPERATION_NOT_ALLOWED,
            '内容导入条目不属于当前工作流任务',
          )
        }
        const itemAttempt =
          itemContext && workflowAttempt
            ? await this.findContentImportItemAttemptByContextInTransaction(
                tx,
                itemContext.item.id,
                workflowAttempt.id,
                workflowAttempt.attemptNo,
              )
            : null
        if (itemContext && workflowAttempt && !itemAttempt) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '内容导入条目 attempt 不存在或已失效',
          )
        }

        const [residue] = await tx
          .insert(this.contentImportResidue)
          .values({
            residueId: randomUUID(),
            workflowJobId: context.workflowJob.id,
            workflowAttemptId: workflowAttempt?.id ?? null,
            contentImportItemId: itemContext?.item.id ?? null,
            contentImportItemAttemptId: itemAttempt?.id ?? null,
            residueType: ContentImportResidueTypeEnum.UPLOADED_FILE,
            provider: String(input.deleteTarget.provider),
            filePath: input.deleteTarget.filePath,
            localPath: input.deleteTarget.objectKey ?? null,
            metadata: input.deleteTarget,
            cleanupStatus: ContentImportResidueCleanupStatusEnum.PENDING,
            cleanupError: null,
            createdAt: new Date(),
            cleanedAt: null,
          })
          .returning()
        return residue.residueId
      },
    })
  }

  // 将残留标记为已处理。
  async markResiduesCleaned(residueIds: string[], db: DbExecutor = this.db) {
    if (residueIds.length === 0) {
      return
    }
    await db
      .update(this.contentImportResidue)
      .set({
        cleanupStatus: ContentImportResidueCleanupStatusEnum.CLEANED,
        cleanupError: null,
        cleanedAt: new Date(),
      })
      .where(inArray(this.contentImportResidue.residueId, residueIds))
  }

  // 将残留标记为清理失败。
  async markResidueCleanupFailed(residueId: string, cleanupErrorText: string) {
    await this.db
      .update(this.contentImportResidue)
      .set({
        cleanupStatus: ContentImportResidueCleanupStatusEnum.FAILED,
        cleanupError: cleanupErrorText.slice(0, 500),
      })
      .where(eq(this.contentImportResidue.residueId, residueId))
  }

  // 列出仍需清理的已上传文件残留；当前 attempt 成功后会先把正式文件标记 clean。
  async listPendingUploadedFileResidues(
    jobId: string,
    options: { itemId?: string } = {},
  ) {
    const workflowJob = await this.readWorkflowJob(jobId)
    const rows = await this.db
      .select({
        itemId: this.contentImportItem.itemId,
        residue: this.contentImportResidue,
      })
      .from(this.contentImportResidue)
      .leftJoin(
        this.contentImportItem,
        eq(
          this.contentImportResidue.contentImportItemId,
          this.contentImportItem.id,
        ),
      )
      .where(
        and(
          eq(this.contentImportResidue.workflowJobId, workflowJob.id),
          eq(
            this.contentImportResidue.residueType,
            ContentImportResidueTypeEnum.UPLOADED_FILE,
          ),
          inArray(this.contentImportResidue.cleanupStatus, [
            ContentImportResidueCleanupStatusEnum.PENDING,
            ContentImportResidueCleanupStatusEnum.FAILED,
          ]),
        ),
      )
    return rows
      .filter((row) => !options.itemId || row.itemId === options.itemId)
      .map((row) => ({
        deleteTarget: row.residue.metadata as UploadDeleteTarget,
        residueId: row.residue.residueId,
      }))
  }

  // 列出 workflow job 级别上传残留，例如新建作品封面。
  async listJobUploadedFileResidues(jobId: string) {
    const workflowJob = await this.readWorkflowJob(jobId)
    const rows = await this.db
      .select({ residue: this.contentImportResidue })
      .from(this.contentImportResidue)
      .where(
        and(
          eq(this.contentImportResidue.workflowJobId, workflowJob.id),
          eq(
            this.contentImportResidue.residueType,
            ContentImportResidueTypeEnum.UPLOADED_FILE,
          ),
          isNull(this.contentImportResidue.contentImportItemId),
        ),
      )
    return rows.map((row) => ({
      deleteTarget: row.residue.metadata as UploadDeleteTarget,
      residueId: row.residue.residueId,
    }))
  }

  // 处理过期 RUNNING attempt：已开始条目标失败，未开始条目交给 SYSTEM_RECOVERY attempt。
  async recoverExpiredAttempt(
    jobId: string,
    expiredAttemptNo: number,
    nextAttemptNo: number,
    tx: DbTransaction,
  ) {
    const located = await this.requireWorkflowImportJobContext(jobId, tx)
    const locatedAttempt = await this.findWorkflowAttemptByJobAndNumber(
      located.workflowJob.id,
      expiredAttemptNo,
      tx,
    )
    await acquireIntegrityLocks(tx, [
      tableIntegrityLock('workflow_job', located.workflowJob.id),
      tableIntegrityLock('content_import_job', located.importJob.id),
      ...(locatedAttempt
        ? [tableIntegrityLock('workflow_attempt', locatedAttempt.id)]
        : []),
    ])
    const context = await this.requireWorkflowImportJobContext(jobId, tx)
    const expiredAttempt = await this.findWorkflowAttemptByJobAndNumber(
      context.workflowJob.id,
      expiredAttemptNo,
      tx,
    )
    if (!expiredAttempt) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '过期工作流 attempt 不存在',
      )
    }
    const now = new Date()
    const runningItems = await tx
      .select({ id: this.contentImportItem.id })
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, context.importJob.id),
          eq(
            this.contentImportItem.status,
            ContentImportItemStatusEnum.RUNNING,
          ),
          eq(this.contentImportItem.currentAttemptNo, expiredAttemptNo),
        ),
      )
    const runningItemIds = runningItems.map((item) => item.id)
    if (runningItemIds.length > 0) {
      const leaseExpiredError = createWorkflowErrorFactsByCode(
        WorkflowErrorCodeEnum.ATTEMPT_LEASE_EXPIRED,
        {
          expiredAttemptNo,
          jobId,
          recoveredAt: now.toISOString(),
        },
      )
      await tx
        .update(this.contentImportItem)
        .set({
          status: ContentImportItemStatusEnum.FAILED,
          stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
          failureCount: sql`${this.contentImportItem.failureCount} + 1`,
          ...toWorkflowLastErrorColumns(leaseExpiredError),
          lastFailedAt: now,
          updatedAt: now,
        })
        .where(inArray(this.contentImportItem.id, runningItemIds))
      await tx
        .update(this.contentImportItemAttempt)
        .set({
          status: ContentImportItemAttemptStatusEnum.FAILED,
          stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
          ...toWorkflowErrorColumns(leaseExpiredError),
          finishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            inArray(
              this.contentImportItemAttempt.contentImportItemId,
              runningItemIds,
            ),
            eq(this.contentImportItemAttempt.attemptNo, expiredAttemptNo),
          ),
        )
    }

    const recoverableItems = await tx
      .select({
        id: this.contentImportItem.id,
        currentAttemptNo: this.contentImportItem.currentAttemptNo,
      })
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, context.importJob.id),
          inArray(this.contentImportItem.status, [
            ContentImportItemStatusEnum.PENDING,
            ContentImportItemStatusEnum.RETRYING,
          ]),
        ),
      )
    const recoverableIds = recoverableItems
      .filter(
        (item) =>
          item.currentAttemptNo === null ||
          item.currentAttemptNo === expiredAttemptNo,
      )
      .map((item) => item.id)
    if (recoverableIds.length > 0) {
      await tx
        .update(this.contentImportItem)
        .set({
          status: ContentImportItemStatusEnum.RETRYING,
          currentAttemptNo: nextAttemptNo,
          updatedAt: now,
        })
        .where(inArray(this.contentImportItem.id, recoverableIds))
    }

    const counters = await this.aggregateJobWithDb(context.importJob.id, tx)
    const attemptCounters = {
      successItemCount: 0,
      failedItemCount: runningItemIds.length,
      skippedItemCount: 0,
    }
    return {
      selectedItemCount: counters.selectedItemCount,
      jobCounters: this.toWorkflowCounterPatch(counters),
      attemptCounters,
      recoverableItemCount: recoverableIds.length,
    }
  }

  // 汇总 job 是否仍有未来自动重试 item。
  async readRetryState(jobId: string) {
    return this.aggregateJobWithRetryState(jobId)
  }

  // 分页查询内容导入条目。
  async getItemPage(input: ContentImportItemPageRequestDto) {
    if (!input.jobId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '工作流任务ID不能为空',
      )
    }
    const importJob = await this.readContentImportJobByWorkflowJobId(
      input.jobId,
    )
    const conditions: SQL[] = [
      eq(this.contentImportItem.contentImportJobId, importJob.id),
    ]
    if (input.status !== undefined) {
      conditions.push(eq(this.contentImportItem.status, input.status))
    }
    const where = and(...conditions)
    const pageQuery = this.drizzle.buildPage({
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
    })
    const orderQuery = this.drizzle.buildOrderBy(
      input.orderBy?.trim() ? input.orderBy : { sortOrder: 'asc', id: 'asc' },
      { table: this.contentImportItem },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.contentImportItemPageSelect)
        .from(this.contentImportItem)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.contentImportItem, where),
    ])
    const page = toPageResult(list, total, pageQuery)
    return {
      ...page,
      list: page.list.map((item) => ({
        id: Number(item.id),
        itemId: item.itemId,
        itemType: item.itemType,
        providerChapterId: item.providerChapterId,
        localChapterId: item.localChapterId,
        title: item.title,
        sortOrder: item.sortOrder,
        status: item.status,
        stage: item.stage,
        failureCount: item.failureCount,
        lastError: toWorkflowLastErrorView(item),
        nextRetryAt: item.nextRetryAt,
        autoRetryCount: item.autoRetryCount,
        maxAutoRetries: item.maxAutoRetries,
        lastRetry: toWorkflowRetryView(item),
        imageTotal: item.imageTotal,
        imageSuccessCount: item.imageSuccessCount,
        metadata: this.asObjectOrNull(item.metadata),
        updatedAt: item.updatedAt,
      })),
    }
  }

  // 分页查询内容导入条目并映射为工作流通用条目。
  async getWorkflowItemPage(input: WorkflowItemPageRequestDto) {
    if (!input.jobId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '工作流任务ID不能为空',
      )
    }
    const importJob = await this.readContentImportJobByWorkflowJobId(
      input.jobId,
    )
    const conditions: SQL[] = [
      eq(this.contentImportItem.contentImportJobId, importJob.id),
    ]
    if (input.status !== undefined) {
      conditions.push(eq(this.contentImportItem.status, input.status))
    }
    const where = and(...conditions)
    const pageQuery = this.drizzle.buildPage({
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
    })
    const orderQuery = this.drizzle.buildOrderBy(
      input.orderBy?.trim() ? input.orderBy : { sortOrder: 'asc', id: 'asc' },
      { table: this.contentImportItem },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.contentImportItemPageSelect)
        .from(this.contentImportItem)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(pageQuery.limit)
        .offset(pageQuery.offset),
      this.db.$count(this.contentImportItem, where),
    ])
    const page = toPageResult(list, total, pageQuery)
    return {
      ...page,
      list: page.list.map((item) => {
        const metadata = {
          autoRetryCount: item.autoRetryCount,
          imageSuccessCount: item.imageSuccessCount,
          imageTotal: item.imageTotal,
          itemType: item.itemType,
          localChapterId: item.localChapterId,
          maxAutoRetries: item.maxAutoRetries,
          providerChapterId: item.providerChapterId,
          sortOrder: item.sortOrder,
          stage: item.stage,
          ...(this.asObjectOrNull(item.metadata) ?? {}),
        }
        return {
          id: Number(item.id),
          itemId: item.itemId,
          title: item.title,
          status: this.toWorkflowItemStatus(item.status),
          subjectType: 'work-chapter',
          subjectId: item.localChapterId,
          subjectLabel: item.title,
          successCount: item.imageSuccessCount,
          totalCount: item.imageTotal,
          failureCount: item.failureCount,
          lastError: toWorkflowLastErrorView(item),
          nextRetryAt: item.nextRetryAt,
          metadata,
          updatedAt: item.updatedAt,
        }
      }),
    }
  }

  // 使用公开 workflow jobId 读取 workflow 与内容导入任务的完整上下文。
  private async findWorkflowImportJobContext(
    jobId: string,
    db: DbTransaction,
  ): Promise<ContentImportJobContext | null> {
    const [row] = await db
      .select({
        importJob: this.contentImportJob,
        workflowJob: this.workflowJob,
      })
      .from(this.workflowJob)
      .innerJoin(
        this.contentImportJob,
        eq(this.contentImportJob.workflowJobId, this.workflowJob.id),
      )
      .where(eq(this.workflowJob.jobId, jobId))
      .limit(1)
    return row ?? null
  }

  // 使用公开 workflow jobId 读取内容导入任务上下文；调用方在锁后必须再次调用。
  private async requireWorkflowImportJobContext(
    jobId: string,
    db: DbTransaction,
  ): Promise<ContentImportJobContext> {
    const context = await this.findWorkflowImportJobContext(jobId, db)
    if (!context) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '内容导入任务不存在',
      )
    }
    return context
  }

  // 对内容导入聚合根加锁，并在同一事务内重新读取其归属链。
  private async withLockedWorkflowImportJob<T>(
    jobId: string,
    execute: (
      tx: DbTransaction,
      context: ContentImportJobContext,
    ) => Promise<T>,
  ): Promise<T> {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const located = await this.requireWorkflowImportJobContext(jobId, tx)
        await acquireIntegrityLocks(tx, [
          tableIntegrityLock('workflow_job', located.workflowJob.id),
          tableIntegrityLock('content_import_job', located.importJob.id),
        ])
        const context = await this.requireWorkflowImportJobContext(jobId, tx)
        return execute(tx, context)
      },
    })
  }

  // 使用公开 itemId 读取其全部归属上下文；该查询只用于定位锁或锁后重查。
  private async findContentImportItemContext(
    itemId: string,
    db: DbExecutor,
  ): Promise<ContentImportItemContext | null> {
    const [row] = await db
      .select({
        importJob: this.contentImportJob,
        item: this.contentImportItem,
        workflowJob: this.workflowJob,
      })
      .from(this.contentImportItem)
      .innerJoin(
        this.contentImportJob,
        eq(this.contentImportItem.contentImportJobId, this.contentImportJob.id),
      )
      .innerJoin(
        this.workflowJob,
        eq(this.contentImportJob.workflowJobId, this.workflowJob.id),
      )
      .where(eq(this.contentImportItem.itemId, itemId))
      .limit(1)
    return row ?? null
  }

  /** 使用同一 DbTransaction 读取条目完整归属链，供锁后重查和状态写入使用。 */
  private async findContentImportItemContextInTransaction(
    tx: DbTransaction,
    itemId: string,
  ): Promise<ContentImportItemContext | null> {
    const [row] = await tx
      .select({
        importJob: this.contentImportJob,
        item: this.contentImportItem,
        workflowJob: this.workflowJob,
      })
      .from(this.contentImportItem)
      .innerJoin(
        this.contentImportJob,
        eq(this.contentImportItem.contentImportJobId, this.contentImportJob.id),
      )
      .innerJoin(
        this.workflowJob,
        eq(this.contentImportJob.workflowJobId, this.workflowJob.id),
      )
      .where(eq(this.contentImportItem.itemId, itemId))
      .limit(1)
    return row ?? null
  }

  /** 锁后在同一 DbTransaction 中重查条目归属；保留既有 not-found 错误语义。 */
  private async requireContentImportItemContextInTransaction(
    tx: DbTransaction,
    itemId: string,
  ): Promise<ContentImportItemContext> {
    const context = await this.findContentImportItemContextInTransaction(
      tx,
      itemId,
    )
    if (!context) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '内容导入条目不存在',
      )
    }
    return context
  }

  // 读取指定 workflow job 内的 attempt 序号。
  private async findWorkflowAttemptByJobAndNumber(
    workflowJobId: bigint,
    attemptNo: number,
    db: DbExecutor,
  ): Promise<WorkflowAttemptIdSnapshot | null> {
    const [row] = await db
      .select({ id: this.workflowAttempt.id })
      .from(this.workflowAttempt)
      .where(
        and(
          eq(this.workflowAttempt.workflowJobId, workflowJobId),
          eq(this.workflowAttempt.attemptNo, attemptNo),
        ),
      )
      .limit(1)
    return row ?? null
  }

  // 读取与 workflow attempt 严格对应的内容条目 attempt。
  private async findContentImportItemAttemptByContext(
    contentImportItemId: bigint,
    workflowAttemptId: bigint,
    attemptNo: number,
    db: DbExecutor,
  ): Promise<ContentImportItemAttemptIdSnapshot | null> {
    const [row] = await db
      .select({ id: this.contentImportItemAttempt.id })
      .from(this.contentImportItemAttempt)
      .where(
        and(
          eq(
            this.contentImportItemAttempt.contentImportItemId,
            contentImportItemId,
          ),
          eq(
            this.contentImportItemAttempt.workflowAttemptId,
            workflowAttemptId,
          ),
          eq(this.contentImportItemAttempt.attemptNo, attemptNo),
        ),
      )
      .limit(1)
    return row ?? null
  }

  /** 在同一 DbTransaction 中重查条目 attempt，供锁后残留记录写入使用。 */
  private async findContentImportItemAttemptByContextInTransaction(
    tx: DbTransaction,
    contentImportItemId: bigint,
    workflowAttemptId: bigint,
    attemptNo: number,
  ): Promise<ContentImportItemAttemptIdSnapshot | null> {
    const [row] = await tx
      .select({ id: this.contentImportItemAttempt.id })
      .from(this.contentImportItemAttempt)
      .where(
        and(
          eq(
            this.contentImportItemAttempt.contentImportItemId,
            contentImportItemId,
          ),
          eq(
            this.contentImportItemAttempt.workflowAttemptId,
            workflowAttemptId,
          ),
          eq(this.contentImportItemAttempt.attemptNo, attemptNo),
        ),
      )
      .limit(1)
    return row ?? null
  }

  /**
   * 以公开 itemId 和 attemptNo 在同一 DbTransaction 中一次性重查完整 attempt 归属链。
   * 返回 null 继续沿用过期 worker 静默 no-op 的原有语义。
   */
  private async findCurrentItemAttemptContextForMutationInTransaction(
    tx: DbTransaction,
    input: ContentImportItemAttemptMutationInput,
  ): Promise<CurrentContentImportItemAttemptContext | null> {
    const [row] = await tx
      .select({
        importJob: this.contentImportJob,
        item: this.contentImportItem,
        itemAttempt: this.contentImportItemAttempt,
        workflowAttempt: this.workflowAttempt,
        workflowJob: this.workflowJob,
      })
      .from(this.contentImportItem)
      .innerJoin(
        this.contentImportJob,
        eq(this.contentImportItem.contentImportJobId, this.contentImportJob.id),
      )
      .innerJoin(
        this.workflowJob,
        eq(this.contentImportJob.workflowJobId, this.workflowJob.id),
      )
      .innerJoin(
        this.workflowAttempt,
        and(
          eq(this.workflowAttempt.workflowJobId, this.workflowJob.id),
          eq(this.workflowAttempt.attemptNo, input.attemptNo),
        ),
      )
      .innerJoin(
        this.contentImportItemAttempt,
        and(
          eq(
            this.contentImportItemAttempt.contentImportItemId,
            this.contentImportItem.id,
          ),
          eq(
            this.contentImportItemAttempt.workflowAttemptId,
            this.workflowAttempt.id,
          ),
          eq(this.contentImportItemAttempt.attemptNo, input.attemptNo),
        ),
      )
      .where(
        and(
          eq(this.contentImportItem.itemId, input.itemId),
          eq(this.contentImportItem.currentAttemptNo, input.attemptNo),
        ),
      )
      .limit(1)
    return row ?? null
  }

  // 使用公开 itemId 读取内容导入条目上下文。
  private async requireContentImportItemContext(
    itemId: string,
    db: DbExecutor,
  ): Promise<ContentImportItemContext> {
    const context = await this.findContentImportItemContext(itemId, db)
    if (!context) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '内容导入条目不存在',
      )
    }
    return context
  }

  // 使用公开 workflow jobId 读取内容导入任务。
  async readContentImportJobByWorkflowJobId(
    jobId: string,
    db: DbExecutor = this.db,
  ) {
    const [row] = await db
      .select({ contentImportJob: this.contentImportJob })
      .from(this.contentImportJob)
      .innerJoin(
        this.workflowJob,
        eq(this.contentImportJob.workflowJobId, this.workflowJob.id),
      )
      .where(eq(this.workflowJob.jobId, jobId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '内容导入任务不存在',
      )
    }
    return row.contentImportJob
  }

  // 使用公开 workflow jobId 读取 workflow job。
  private async readWorkflowJob(
    jobId: string,
    db: DbExecutor = this.db,
  ): Promise<WorkflowJobIdSnapshot> {
    const [row] = await db
      .select({ id: this.workflowJob.id })
      .from(this.workflowJob)
      .where(eq(this.workflowJob.jobId, jobId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流任务不存在',
      )
    }
    return row
  }

  // 使用公开 workflow attemptId 读取 workflow attempt。
  private async readWorkflowAttempt(
    attemptId: string,
    db: DbTransaction,
  ): Promise<WorkflowAttemptIdentitySnapshot> {
    const [row] = await db
      .select({
        id: this.workflowAttempt.id,
        workflowJobId: this.workflowAttempt.workflowJobId,
        attemptNo: this.workflowAttempt.attemptNo,
      })
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.attemptId, attemptId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流 attempt 不存在',
      )
    }
    return row
  }

  /** 使用同一 DbTransaction 重查公开 workflow attempt，供引用写入继承锁后证据。 */
  private async readWorkflowAttemptInTransaction(
    tx: DbTransaction,
    attemptId: string,
  ): Promise<WorkflowAttemptIdentitySnapshot> {
    const [row] = await tx
      .select({
        id: this.workflowAttempt.id,
        workflowJobId: this.workflowAttempt.workflowJobId,
        attemptNo: this.workflowAttempt.attemptNo,
      })
      .from(this.workflowAttempt)
      .where(eq(this.workflowAttempt.attemptId, attemptId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '工作流 attempt 不存在',
      )
    }
    return row
  }

  // 资源初始化回调只允许操作其刚创建的 workflow job。
  private assertWorkflowJobIdentity(
    workflowJob: WorkflowJobSelect,
    jobId: string,
  ) {
    if (workflowJob.jobId !== jobId) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '内容导入任务与工作流任务不匹配',
      )
    }
  }

  // 确保 attempt 不会被跨工作流任务复用。
  private assertWorkflowAttemptBelongsToJob(
    workflowAttempt: Pick<WorkflowAttemptSelect, 'workflowJobId'>,
    workflowJob: Pick<WorkflowJobSelect, 'id'>,
  ) {
    if (workflowAttempt.workflowJobId !== workflowJob.id) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '工作流 attempt 不属于当前内容导入任务',
      )
    }
  }

  // 两行状态转换必须作为一个整体提交，第二行缺失时回滚第一行。
  private assertItemAttemptUpdated(itemAttempt: { id: bigint } | undefined) {
    if (!itemAttempt) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '内容导入条目 attempt 状态已变更',
      )
    }
  }

  // 在指定 db 中聚合内容导入任务计数。
  private async aggregateJobWithDb(contentImportJobId: bigint, db: DbExecutor) {
    const rows = await db
      .select({
        status: this.contentImportItem.status,
        imageTotal: this.contentImportItem.imageTotal,
        imageSuccessCount: this.contentImportItem.imageSuccessCount,
      })
      .from(this.contentImportItem)
      .where(eq(this.contentImportItem.contentImportJobId, contentImportJobId))
    return this.aggregateRows(contentImportJobId, rows, db)
  }

  private async aggregateRows(
    contentImportJobId: bigint,
    rows: ContentImportAggregateItem[],
    db: DbExecutor,
  ) {
    const imageTotal = rows.reduce(
      (sum, row) => sum + this.normalizeImageCount(row.imageTotal),
      0,
    )
    const imageSuccessCount = rows.reduce(
      (sum, row) =>
        sum +
        Math.min(
          this.normalizeImageCount(row.imageTotal),
          this.normalizeImageCount(row.imageSuccessCount),
        ),
      0,
    )
    const counters = {
      selectedItemCount: rows.length,
      successItemCount: rows.filter(
        (row) => row.status === ContentImportItemStatusEnum.SUCCESS,
      ).length,
      failedItemCount: rows.filter(
        (row) => row.status === ContentImportItemStatusEnum.FAILED,
      ).length,
      skippedItemCount: rows.filter(
        (row) => row.status === ContentImportItemStatusEnum.SKIPPED,
      ).length,
      imageTotal,
      imageSuccessCount,
      imageFailedCount: Math.max(0, imageTotal - imageSuccessCount),
    }
    await db
      .update(this.contentImportJob)
      .set({
        ...counters,
        updatedAt: new Date(),
      })
      .where(eq(this.contentImportJob.id, contentImportJobId))
    return counters
  }

  private aggregateAttemptRows(
    rows: Array<{
      imageSuccessCount: number
      imageTotal: number
      status: number
    }>,
  ): ContentImportAttemptCounters {
    const imageTotal = rows.reduce(
      (sum, row) => sum + this.normalizeImageCount(row.imageTotal),
      0,
    )
    const imageSuccessCount = rows.reduce(
      (sum, row) =>
        sum +
        Math.min(
          this.normalizeImageCount(row.imageTotal),
          this.normalizeImageCount(row.imageSuccessCount),
        ),
      0,
    )
    return {
      selectedItemCount: rows.length,
      successItemCount: rows.filter(
        (row) => row.status === ContentImportItemAttemptStatusEnum.SUCCESS,
      ).length,
      failedItemCount: rows.filter(
        (row) => row.status === ContentImportItemAttemptStatusEnum.FAILED,
      ).length,
      skippedItemCount: 0,
      imageTotal,
      imageSuccessCount,
      imageFailedCount: Math.max(0, imageTotal - imageSuccessCount),
    }
  }

  private async aggregateRowsWithRetryState(
    contentImportJobId: bigint,
    rows: ContentImportAggregateItemWithRetryState[],
    db: DbExecutor,
  ): Promise<ContentImportAttemptCountersWithRetry> {
    const counters = await this.aggregateRows(contentImportJobId, rows, db)
    const now = new Date()
    const futureRetryTimes = rows
      .filter(
        (row) =>
          row.status === ContentImportItemStatusEnum.RETRYING &&
          row.nextRetryAt &&
          row.nextRetryAt > now,
      )
      .map((row) => row.nextRetryAt as Date)
    const nextRetryAt =
      futureRetryTimes.length > 0
        ? futureRetryTimes.reduce((earliest, item) =>
            item < earliest ? item : earliest,
          )
        : null
    return {
      ...counters,
      futureRetryItemCount: futureRetryTimes.length,
      nextRetryAt,
    }
  }

  private toWorkflowCounterPatch(counters: ContentImportAttemptCounters) {
    return {
      successItemCount: counters.successItemCount,
      failedItemCount: counters.failedItemCount,
      skippedItemCount: counters.skippedItemCount,
    }
  }

  private toWorkflowItemStatus(status: ContentImportItemStatusEnum) {
    return status as unknown as WorkflowItemStatusEnum
  }

  private buildImageCounterPatch(input: {
    imageTotal?: number
    imageSuccessCount?: number
  }) {
    if (
      input.imageTotal === undefined &&
      input.imageSuccessCount === undefined
    ) {
      return {}
    }
    const imageTotal = this.normalizeImageCount(input.imageTotal)
    return {
      imageTotal,
      imageSuccessCount: Math.min(
        imageTotal,
        this.normalizeImageCount(input.imageSuccessCount),
      ),
    }
  }

  private normalizeImageCount(value: unknown) {
    if (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value > 0
    ) {
      return value
    }
    return 0
  }

  // 归一化 JSON 对象。
  private asObjectOrNull(value: unknown) {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null
  }
}
