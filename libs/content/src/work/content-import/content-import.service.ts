import type { Db } from '@db/core'
import type { ThirdPartyComicSyncChapterPlan } from '@libs/content/work/third-party/third-party-comic-sync.type'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type { SQL } from 'drizzle-orm'
import type {
  ContentImportExecutableItem,
  ContentImportMarkItemFailedInput,
  ContentImportMarkItemSuccessInput,
  ContentImportRecordUploadedFileResidueInput,
  CreateThirdPartyImportContentJobInput,
  CreateThirdPartySyncContentJobInput,
} from './content-import.type'
import { randomUUID } from 'node:crypto'
import { DrizzleService } from '@db/core'
import {
  BusinessErrorCode,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
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

  // 读取 contentImportItemAttempt。
  private get contentImportItemAttempt() {
    return this.drizzle.schema.contentImportItemAttempt
  }

  // 读取 contentImportResidue。
  private get contentImportResidue() {
    return this.drizzle.schema.contentImportResidue
  }

  // 创建三方导入领域任务和章节条目。
  async createThirdPartyImportJob(input: CreateThirdPartyImportContentJobInput) {
    const workflowJob = await this.readWorkflowJob(input.jobId)
    const now = new Date()
    const providerGroupPathWord =
      input.dto.sourceSnapshot.providerGroupPathWord ??
      input.dto.chapters.at(0)?.group ??
      null
    const [job] = await this.db
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
        sourceSnapshot: input.dto as unknown as Record<string, unknown>,
        publishBoundaryStatus:
          ContentImportPublishBoundaryStatusEnum.NEEDS_MANUAL_REVIEW,
        selectedItemCount: input.dto.chapters.length,
        imageTotal: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (input.dto.chapters.length > 0) {
      await this.db.insert(this.contentImportItem).values(
        input.dto.chapters.map((chapter) => ({
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
          lastErrorCode: null,
          lastErrorMessage: null,
          lastFailedAt: null,
          imageTotal: 0,
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

  // 创建三方同步领域任务，章节条目由执行期扫描后补齐。
  async createThirdPartySyncJob(input: CreateThirdPartySyncContentJobInput) {
    const workflowJob = await this.readWorkflowJob(input.jobId)
    const now = new Date()
    const [job] = await this.db
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
    plans: ThirdPartyComicSyncChapterPlan[],
    attemptNo: number,
  ) {
    const workflowJob = await this.readWorkflowJob(jobId)
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId)
    const now = new Date()
    await this.db
      .delete(this.contentImportItem)
      .where(eq(this.contentImportItem.contentImportJobId, importJob.id))
    if (plans.length > 0) {
      await this.db.insert(this.contentImportItem).values(
        plans.map((plan) => ({
          itemId: randomUUID(),
          contentImportJobId: importJob.id,
          itemType: ContentImportItemTypeEnum.COMIC_CHAPTER,
          providerChapterId: plan.providerChapterId,
          targetChapterId: null,
          localChapterId: null,
          title: plan.title,
          sortOrder: plan.localSortOrder,
          status: ContentImportItemStatusEnum.PENDING,
          stage: ContentImportItemStageEnum.READING_SOURCE,
          failureCount: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastFailedAt: null,
          imageTotal: plan.imageTotal,
          imageSuccessCount: 0,
          currentAttemptNo: null,
          metadata: { plan },
          createdAt: now,
          updatedAt: now,
        })),
      )
    }
    await this.db
      .update(this.contentImportJob)
      .set({
        selectedItemCount: plans.length,
        imageTotal: plans.reduce((sum, plan) => sum + plan.imageTotal, 0),
        updatedAt: now,
      })
      .where(eq(this.contentImportJob.id, importJob.id))
    await this.db
      .update(this.workflowJob)
      .set({
        selectedItemCount: plans.length,
        updatedAt: now,
      })
      .where(eq(this.workflowJob.id, workflowJob.id))
    await this.db
      .update(this.workflowAttempt)
      .set({
        selectedItemCount: plans.length,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.workflowAttempt.workflowJobId, workflowJob.id),
          eq(this.workflowAttempt.attemptNo, attemptNo),
        ),
      )
  }

  // 校验并准备人工重试条目。
  async prepareRetryItems(
    jobId: string,
    selectedItemIds: string[],
    nextAttemptNo: number,
    tx: Db,
  ) {
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId, tx)
    const items = await tx
      .select()
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
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
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
          inArray(this.contentImportItem.itemId, selectedItemIds),
        ),
      )
  }

  // 读取当前 attempt 应处理的内容导入条目。
  async listExecutableItems(jobId: string, attemptNo: number) {
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId)
    const statusFilter =
      attemptNo === 1
        ? [
            ContentImportItemStatusEnum.PENDING,
            ContentImportItemStatusEnum.RETRYING,
          ]
        : [ContentImportItemStatusEnum.RETRYING]

    const rows = await this.db
      .select()
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
          inArray(this.contentImportItem.status, statusFilter),
          attemptNo === 1
            ? isNull(this.contentImportItem.currentAttemptNo)
            : eq(this.contentImportItem.currentAttemptNo, attemptNo),
        ),
      )
      .orderBy(asc(this.contentImportItem.sortOrder), asc(this.contentImportItem.id))

    return rows as ContentImportExecutableItem[]
  }

  // 开始处理单个条目，并创建条目 attempt。
  async startItemAttempt(jobId: string, attemptId: string, itemId: string) {
    const workflowAttempt = await this.readWorkflowAttempt(attemptId)
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId)
    const [item] = await this.db
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.RUNNING,
        currentAttemptNo: workflowAttempt.attemptNo,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
          eq(this.contentImportItem.itemId, itemId),
        ),
      )
      .returning()
    if (!item) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '内容导入条目不存在',
      )
    }

    const [itemAttempt] = await this.db
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
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return { item, itemAttempt }
  }

  // 标记条目成功。
  async markItemSuccess(input: ContentImportMarkItemSuccessInput) {
    const now = new Date()
    const [item] = await this.db
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.SUCCESS,
        stage: ContentImportItemStageEnum.DONE,
        localChapterId: input.localChapterId ?? undefined,
        imageTotal: input.imageTotal ?? 0,
        imageSuccessCount: input.imageSuccessCount ?? 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastFailedAt: null,
        updatedAt: now,
      })
      .where(eq(this.contentImportItem.itemId, input.itemId))
      .returning()
    if (!item) {
      return
    }
    await this.db
      .update(this.contentImportItemAttempt)
      .set({
        status: ContentImportItemAttemptStatusEnum.SUCCESS,
        stage: ContentImportItemStageEnum.DONE,
        imageTotal: input.imageTotal ?? 0,
        imageSuccessCount: input.imageSuccessCount ?? 0,
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.contentImportItemAttempt.contentImportItemId, item.id),
          eq(this.contentImportItemAttempt.attemptNo, input.attemptNo),
        ),
      )
  }

  // 标记条目失败。
  async markItemFailed(input: ContentImportMarkItemFailedInput) {
    const now = new Date()
    const [item] = await this.db
      .update(this.contentImportItem)
      .set({
        status: ContentImportItemStatusEnum.FAILED,
        stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
        failureCount: sql`${this.contentImportItem.failureCount} + 1`,
        lastErrorCode: input.errorCode,
        lastErrorMessage: input.errorMessage,
        lastFailedAt: now,
        imageTotal: input.imageTotal ?? 0,
        imageSuccessCount: input.imageSuccessCount ?? 0,
        updatedAt: now,
      })
      .where(eq(this.contentImportItem.itemId, input.itemId))
      .returning()
    if (!item) {
      return
    }
    await this.db
      .update(this.contentImportItemAttempt)
      .set({
        status: ContentImportItemAttemptStatusEnum.FAILED,
        stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
        imageTotal: input.imageTotal ?? 0,
        imageSuccessCount: input.imageSuccessCount ?? 0,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        finishedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(this.contentImportItemAttempt.contentImportItemId, item.id),
          eq(this.contentImportItemAttempt.attemptNo, input.attemptNo),
        ),
      )
  }

  // 聚合内容导入任务计数。
  async aggregateJob(jobId: string) {
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId)
    const rows = await this.db
      .select()
      .from(this.contentImportItem)
      .where(eq(this.contentImportItem.contentImportJobId, importJob.id))
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
    }
    const imageTotal = rows.reduce((sum, row) => sum + row.imageTotal, 0)
    const imageSuccessCount = rows.reduce(
      (sum, row) => sum + row.imageSuccessCount,
      0,
    )
    await this.db
      .update(this.contentImportJob)
      .set({
        ...counters,
        imageTotal,
        imageSuccessCount,
        imageFailedCount: Math.max(0, imageTotal - imageSuccessCount),
        updatedAt: new Date(),
      })
      .where(eq(this.contentImportJob.id, importJob.id))
    return counters
  }

  // 记录已上传文件残留，供失败补偿和崩溃后清理使用。
  async recordUploadedFileResidue(input: ContentImportRecordUploadedFileResidueInput) {
    const workflowJob = await this.readWorkflowJob(input.jobId)
    const workflowAttempt = input.attemptId
      ? await this.readWorkflowAttempt(input.attemptId)
      : null
    const item = input.itemId
      ? await this.readContentImportItemByItemId(input.itemId)
      : null
    const itemAttempt =
      item && workflowAttempt
        ? await this.readContentImportItemAttempt(item.id, workflowAttempt.attemptNo)
        : null
    const [residue] = await this.db
      .insert(this.contentImportResidue)
      .values({
        residueId: randomUUID(),
        workflowJobId: workflowJob.id,
        workflowAttemptId: workflowAttempt?.id ?? null,
        contentImportItemId: item?.id ?? null,
        contentImportItemAttemptId: itemAttempt?.id ?? null,
        residueType: ContentImportResidueTypeEnum.UPLOADED_FILE,
        provider: String(input.deleteTarget.provider),
        filePath: input.deleteTarget.filePath,
        localPath: input.deleteTarget.objectKey ?? null,
        metadata: input.deleteTarget as unknown as Record<string, unknown>,
        cleanupStatus: ContentImportResidueCleanupStatusEnum.PENDING,
        cleanupError: null,
        createdAt: new Date(),
        cleanedAt: null,
      })
      .returning()
    return residue.residueId
  }

  // 将残留标记为已处理。
  async markResiduesCleaned(residueIds: string[], db: Db = this.db) {
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
  async markResidueCleanupFailed(residueId: string, errorMessage: string) {
    await this.db
      .update(this.contentImportResidue)
      .set({
        cleanupStatus: ContentImportResidueCleanupStatusEnum.FAILED,
        cleanupError: errorMessage.slice(0, 500),
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
          inArray(
            this.contentImportResidue.cleanupStatus,
            [
              ContentImportResidueCleanupStatusEnum.PENDING,
              ContentImportResidueCleanupStatusEnum.FAILED,
            ],
          ),
        ),
      )
    return rows
      .filter((row) => !options.itemId || row.itemId === options.itemId)
      .map((row) => ({
        deleteTarget: row.residue.metadata as UploadDeleteTarget,
        residueId: row.residue.residueId,
      }))
  }

  // 处理过期 RUNNING attempt：已开始条目标失败，未开始条目交给 SYSTEM_RECOVERY attempt。
  async recoverExpiredAttempt(
    jobId: string,
    expiredAttemptNo: number,
    nextAttemptNo: number,
    tx: Db,
  ) {
    const importJob = await this.readContentImportJobByWorkflowJobId(jobId, tx)
    const now = new Date()
    const runningItems = await tx
      .select()
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
          eq(this.contentImportItem.status, ContentImportItemStatusEnum.RUNNING),
          eq(this.contentImportItem.currentAttemptNo, expiredAttemptNo),
        ),
      )
    const runningItemIds = runningItems.map((item) => item.id)
    if (runningItemIds.length > 0) {
      await tx
        .update(this.contentImportItem)
        .set({
          status: ContentImportItemStatusEnum.FAILED,
          stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
          failureCount: sql`${this.contentImportItem.failureCount} + 1`,
          lastErrorCode: 'ATTEMPT_LEASE_EXPIRED',
          lastErrorMessage: 'workflow attempt claim 已过期',
          lastFailedAt: now,
          updatedAt: now,
        })
        .where(inArray(this.contentImportItem.id, runningItemIds))
      await tx
        .update(this.contentImportItemAttempt)
        .set({
          status: ContentImportItemAttemptStatusEnum.FAILED,
          stage: ContentImportItemStageEnum.CLEANING_RESIDUE,
          errorCode: 'ATTEMPT_LEASE_EXPIRED',
          errorMessage: 'workflow attempt claim 已过期',
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
      .select()
      .from(this.contentImportItem)
      .where(
        and(
          eq(this.contentImportItem.contentImportJobId, importJob.id),
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

    const counters = await this.aggregateJobWithDb(importJob.id, tx)
    return {
      ...counters,
      recoverableItemCount: recoverableIds.length,
    }
  }

  // 分页查询内容导入条目。
  async getItemPage(input: ContentImportItemPageRequestDto) {
    if (!input.jobId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '工作流任务ID不能为空',
      )
    }
    const importJob = await this.readContentImportJobByWorkflowJobId(input.jobId)
    const conditions: SQL[] = [
      eq(this.contentImportItem.contentImportJobId, importJob.id),
    ]
    if (input.status !== undefined) {
      conditions.push(eq(this.contentImportItem.status, input.status))
    }
    const page = await this.drizzle.ext.findPagination(this.contentImportItem, {
      where: and(...conditions),
      pageIndex: input.pageIndex,
      pageSize: input.pageSize,
      orderBy: input.orderBy?.trim()
        ? input.orderBy
        : { sortOrder: 'asc', id: 'asc' },
    })
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
        lastErrorCode: item.lastErrorCode,
        lastErrorMessage: item.lastErrorMessage,
        imageTotal: item.imageTotal,
        imageSuccessCount: item.imageSuccessCount,
        metadata: this.asObjectOrNull(item.metadata),
        updatedAt: item.updatedAt,
      })),
    }
  }

  // 使用公开 workflow jobId 读取内容导入任务。
  async readContentImportJobByWorkflowJobId(jobId: string, db: Db = this.db) {
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
  private async readWorkflowJob(jobId: string) {
    const [row] = await this.db
      .select()
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
  private async readWorkflowAttempt(attemptId: string) {
    const [row] = await this.db
      .select()
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

  // 使用公开 itemId 读取内容导入条目。
  private async readContentImportItemByItemId(itemId: string) {
    const [row] = await this.db
      .select()
      .from(this.contentImportItem)
      .where(eq(this.contentImportItem.itemId, itemId))
      .limit(1)
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '内容导入条目不存在',
      )
    }
    return row
  }

  // 读取内容导入条目 attempt。
  private async readContentImportItemAttempt(
    contentImportItemId: bigint,
    attemptNo: number,
  ) {
    const [row] = await this.db
      .select()
      .from(this.contentImportItemAttempt)
      .where(
        and(
          eq(this.contentImportItemAttempt.contentImportItemId, contentImportItemId),
          eq(this.contentImportItemAttempt.attemptNo, attemptNo),
        ),
      )
      .limit(1)
    return row ?? null
  }

  // 在指定 db 中聚合内容导入任务计数。
  private async aggregateJobWithDb(contentImportJobId: bigint, db: Db) {
    const rows = await db
      .select()
      .from(this.contentImportItem)
      .where(eq(this.contentImportItem.contentImportJobId, contentImportJobId))
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
    }
    const imageTotal = rows.reduce((sum, row) => sum + row.imageTotal, 0)
    const imageSuccessCount = rows.reduce(
      (sum, row) => sum + row.imageSuccessCount,
      0,
    )
    await db
      .update(this.contentImportJob)
      .set({
        ...counters,
        imageTotal,
        imageSuccessCount,
        imageFailedCount: Math.max(0, imageTotal - imageSuccessCount),
        updatedAt: new Date(),
      })
      .where(eq(this.contentImportJob.id, contentImportJobId))
    return counters
  }

  // 归一化 JSON 对象。
  private asObjectOrNull(value: unknown) {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null
  }
}
