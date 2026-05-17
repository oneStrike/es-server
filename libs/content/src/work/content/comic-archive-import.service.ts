import type { Db } from '@db/core'
import type { UploadConfigInterface } from '@libs/platform/config'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type { WorkflowExecutionContext } from '@libs/platform/modules/workflow/workflow.type'
import type { FastifyRequest } from 'fastify'
import type { Dirent } from 'node:fs'
import type {
  ArchiveWorkflowImportRecord,
  ComicArchiveDetailInput,
  ComicArchiveIgnoredItemSnapshot,
  ComicArchiveMatchedItemRecord,
  ComicArchivePreviewChapter,
  ComicArchivePreviewChapterMap,
} from './comic-archive-import.type'
import { createWriteStream, promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { DrizzleService } from '@db/core'
import {
  ContentImportContentTypeEnum,
  ContentImportItemStageEnum,
  ContentImportItemStatusEnum,
  ContentImportItemTypeEnum,
  ContentImportPublishBoundaryStatusEnum,
  ContentImportSourceTypeEnum,
  ContentImportWorkflowType,
} from '@libs/content/work/content-import/content-import.constant'
import { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { UploadService } from '@libs/platform/modules/upload/upload.service'
import {
  WorkflowAttemptStatusEnum,
  WorkflowJobStatusEnum,
  WorkflowOperatorTypeEnum,
} from '@libs/platform/modules/workflow/workflow.constant'
import { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import { jsonParse } from '@libs/platform/utils'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import * as unzipper from 'unzipper'
import { v4 as uuidv4 } from 'uuid'
import {
  ComicArchiveIgnoreReasonEnum,
  ComicArchiveImportItemStatusEnum,
  ComicArchivePreviewModeEnum,
  ComicArchiveTaskStatusEnum,
} from './comic-archive-import.constant'
import {
  ComicArchiveTaskResponseDto,
  ConfirmComicArchiveDto,
  CreateComicArchiveSessionDto,
  DiscardComicArchiveDto,
  PreviewComicArchiveDto,
} from './dto/content.dto'

const ARCHIVE_EXTENSION = '.zip'
const ARCHIVE_TASK_TTL_MS = 24 * 60 * 60 * 1000
const AUTO_IGNORED_ENTRY_NAMES = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db'])
const CHAPTER_ID_DIRECTORY_RE = /^\d+$/
const WINDOWS_ABSOLUTE_PATH_RE = /^[a-z]:/i

/**
 * 漫画压缩包导入服务。
 * 负责预解析 zip、生成前端确认结果，以及驱动确认后的 workflow 导入执行。
 */
@Injectable()
export class ComicArchiveImportService {
  private readonly uploadConfig: UploadConfigInterface

  // 初始化 ComicArchiveImportService 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
    private readonly workflowService: WorkflowService,
    private readonly contentImportService: ContentImportService,
  ) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 work。
  private get work() {
    return this.drizzle.schema.work
  }

  // 读取 workChapter。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 读取 workflowJob。
  private get workflowJob() {
    return this.drizzle.schema.workflowJob
  }

  // 读取 contentImportJob。
  private get contentImportJob() {
    return this.drizzle.schema.contentImportJob
  }

  // 读取 contentImportPreviewItem。
  private get contentImportPreviewItem() {
    return this.drizzle.schema.contentImportPreviewItem
  }

  // 读取 contentImportItem。
  private get contentImportItem() {
    return this.drizzle.schema.contentImportItem
  }

  // 创建预解析会话，前端拿到 jobId 后再发起 multipart 预解析上传。
  async createPreviewSession(input: CreateComicArchiveSessionDto, userId: number) {
    await this.assertWorkExists(input.workId)

    const now = new Date()
    const job = await this.workflowService.createDraft({
      workflowType: ContentImportWorkflowType.ARCHIVE_IMPORT,
      displayName: `漫画压缩包导入 #${input.workId}`,
      operator: {
        type: WorkflowOperatorTypeEnum.ADMIN,
        userId,
      },
      selectedItemCount: 0,
      expiresAt: new Date(now.getTime() + ARCHIVE_TASK_TTL_MS),
      summary: {
        workId: input.workId,
        chapterId: input.chapterId ?? null,
      },
      conflictKeys: [`archive-import:comic:work:${input.workId}`],
    })

    const workflowJob = await this.readWorkflowJob(job.jobId)
    await this.db.insert(this.contentImportJob).values({
      workflowJobId: workflowJob.id,
      contentType: ContentImportContentTypeEnum.COMIC,
      sourceType: ContentImportSourceTypeEnum.ARCHIVE_IMPORT,
      workId: input.workId,
      sourceSnapshot: input as unknown as Record<string, unknown>,
      publishBoundaryStatus:
        ContentImportPublishBoundaryStatusEnum.NEEDS_MANUAL_REVIEW,
      selectedItemCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { jobId: job.jobId }
  }

  // 预解析漫画压缩包并返回前端确认结果，预解析阶段只产出草稿任务，不会写章节内容，也不会上传页面图片到最终 provider。
  async previewArchive(
    req: FastifyRequest,
    input: PreviewComicArchiveDto,
  ): Promise<ComicArchiveTaskResponseDto> {
    await this.assertWorkExists(input.workId)
    await this.assertArchiveDraftOpen(input.jobId, input.workId)
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(
        input.jobId,
      )

    const archiveFile = await req.file()
    if (!archiveFile) {
      throw new BadRequestException('上传文件不能为空')
    }

    if (extname(archiveFile.filename).toLowerCase() !== ARCHIVE_EXTENSION) {
      await this.consumeStream(archiveFile.file)
      throw new BadRequestException('仅支持 zip 压缩包')
    }

    const jobId = input.jobId
    const taskDir = this.getTaskDir(jobId)
    const extractDir = this.getTaskExtractDir(jobId)
    const archivePath = join(taskDir, 'source.zip')

    await fs.mkdir(extractDir, { recursive: true })

    try {
      await pipeline(archiveFile.file, createWriteStream(archivePath))
      if (archiveFile.file.truncated) {
        throw new PayloadTooLargeException('文件大小超过限制')
      }

      await this.extractArchive(archivePath, extractDir)

      const chapters = await this.loadWorkChapters(input.workId)
      const previewResult = await this.buildPreviewResult(
        input,
        archiveFile.filename,
        extractDir,
        chapters,
      )
      const now = new Date()
      await this.drizzle.withTransaction(async (tx) => {
        await this.lockArchiveDraft(input.jobId, input.workId, tx)
        await tx
          .update(this.contentImportJob)
          .set({
            archiveName: archiveFile.filename,
            archivePath,
            extractPath: extractDir,
            previewMode: previewResult.mode,
            selectedItemCount: previewResult.matchedItems.length,
            imageTotal: previewResult.matchedItems.reduce(
              (sum, item) => sum + item.imageCount,
              0,
            ),
            updatedAt: now,
          })
          .where(eq(this.contentImportJob.id, importJob.id))
        await tx
          .delete(this.contentImportPreviewItem)
          .where(eq(this.contentImportPreviewItem.contentImportJobId, importJob.id))
        const previewItems = [
          ...previewResult.matchedItems.map((item) => ({
            previewItemId: uuidv4(),
            contentImportJobId: importJob.id,
            itemType: ContentImportItemTypeEnum.COMIC_CHAPTER,
            sourcePath: item.path,
            providerChapterId: null,
            targetChapterId: item.chapterId,
            title: item.chapterTitle,
            sortOrder: item.chapterId,
            imageTotal: item.imageCount,
            status: 1,
            ignoreReason: null,
            warningMessage: null,
            metadata: item as unknown as Record<string, unknown>,
            createdAt: now,
            updatedAt: now,
          })),
          ...previewResult.ignoredItems.map((item, index) => ({
            previewItemId: uuidv4(),
            contentImportJobId: importJob.id,
            itemType: ContentImportItemTypeEnum.COMIC_CHAPTER,
            sourcePath: item.path,
            providerChapterId: null,
            targetChapterId: null,
            title: item.path || `ignored-${index + 1}`,
            sortOrder: index,
            imageTotal: 0,
            status: 2,
            ignoreReason: String(item.reason),
            warningMessage: item.message ?? null,
            metadata: item as unknown as Record<string, unknown>,
            createdAt: now,
            updatedAt: now,
          })),
        ]
        if (previewItems.length > 0) {
          await tx.insert(this.contentImportPreviewItem).values(previewItems)
        }
      })
      return await this.getArchiveDetail({ jobId: input.jobId })
    } catch (error) {
      await fs
        .rm(taskDir, { recursive: true, force: true })
        .catch(() => undefined)

      if (
        error instanceof BusinessException ||
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error
      }
      throw new InternalServerErrorException('压缩包预解析失败')
    }
  }

  // 确认漫画压缩包导入任务，用户确认后仅把草稿任务推进到 pending，由 workflow worker 执行正式导入。
  async confirmArchive(input: ConfirmComicArchiveDto) {
    const confirmedChapterIds = [...new Set(input.confirmedChapterIds)]
    if (confirmedChapterIds.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '请至少确认一个可导入章节',
      )
    }

    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(
        input.jobId,
      )
    await this.assertArchiveDraftOpen(input.jobId, importJob.workId ?? undefined)
    const previewItems = await this.db
      .select()
      .from(this.contentImportPreviewItem)
      .where(
        and(
          eq(this.contentImportPreviewItem.contentImportJobId, importJob.id),
          inArray(this.contentImportPreviewItem.targetChapterId, confirmedChapterIds),
        ),
      )
    if (previewItems.length !== confirmedChapterIds.length) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '存在未通过预解析确认的章节',
      )
    }

    const now = new Date()
    await this.db.delete(this.contentImportItem).where(
      eq(this.contentImportItem.contentImportJobId, importJob.id),
    )
    await this.db.insert(this.contentImportItem).values(
      previewItems.map((item) => ({
        itemId: uuidv4(),
        contentImportJobId: importJob.id,
        itemType: ContentImportItemTypeEnum.COMIC_CHAPTER,
        providerChapterId: null,
        targetChapterId: item.targetChapterId,
        localChapterId: item.targetChapterId,
        title: item.title,
        sortOrder: item.sortOrder,
        status: ContentImportItemStatusEnum.PENDING,
        stage: ContentImportItemStageEnum.READING_SOURCE,
        failureCount: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastFailedAt: null,
        imageTotal: item.imageTotal,
        imageSuccessCount: 0,
        currentAttemptNo: null,
        metadata: item.metadata as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })),
    )
    await this.db
      .update(this.contentImportJob)
      .set({
        selectedItemCount: previewItems.length,
        imageTotal: previewItems.reduce((sum, item) => sum + item.imageTotal, 0),
        updatedAt: now,
      })
      .where(eq(this.contentImportJob.id, importJob.id))
    return this.workflowService.confirmDraft({ jobId: input.jobId })
  }

  // 丢弃预确认漫画压缩包导入会话，先关闭草稿状态再移除本地临时目录，避免迟到上传复活预览。
  async discardArchivePreview(input: DiscardComicArchiveDto) {
    const job = await this.workflowService.cancelJob({ jobId: input.jobId })
    await this.removeTaskDir(input.jobId)
    return job
  }

  // 清理过期草稿的本地压缩包和解压残留。
  async cleanupExpiredDraft(jobId: string) {
    await this.cleanupWorkflowJobResources(jobId)
  }

  // 清理失败/部分失败任务在管理员确认过期后保留的本地资源。
  async cleanupRetainedResources(jobId: string) {
    await this.cleanupWorkflowJobResources(jobId)
  }

  // 查询漫画压缩包导入任务详情，前端可用该接口轮询预解析草稿和 workflow 导入执行状态。
  async getArchiveDetail(input: ComicArchiveDetailInput) {
    const jobId = input.jobId
    const workflowJob = await this.readWorkflowJob(jobId)
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(jobId)
    const previewItems = await this.db
      .select()
      .from(this.contentImportPreviewItem)
      .where(eq(this.contentImportPreviewItem.contentImportJobId, importJob.id))
      .orderBy(asc(this.contentImportPreviewItem.sortOrder), asc(this.contentImportPreviewItem.id))
    const items = await this.db
      .select()
      .from(this.contentImportItem)
      .where(eq(this.contentImportItem.contentImportJobId, importJob.id))
      .orderBy(asc(this.contentImportItem.sortOrder), asc(this.contentImportItem.id))

    return {
      jobId,
      workId: importJob.workId ?? 0,
      mode: importJob.previewMode ?? ComicArchivePreviewModeEnum.SINGLE_CHAPTER,
      status: this.toArchiveStatus(workflowJob.status),
      archiveName: importJob.archiveName,
      requireConfirm: previewItems.some((item) => item.status === 1),
      matchedItems: previewItems
        .filter((item) => item.status === 1)
        .map((item) => item.metadata as ComicArchiveMatchedItemRecord),
      ignoredItems: previewItems
        .filter((item) => item.status === 2)
        .map((item) => item.metadata as ComicArchiveIgnoredItemSnapshot),
      resultItems: items.map((item) => ({
        chapterId: item.localChapterId ?? item.targetChapterId ?? 0,
        chapterTitle: item.title,
        importedImageCount: item.imageSuccessCount,
        status:
          item.status === ContentImportItemStatusEnum.SUCCESS
            ? ComicArchiveImportItemStatusEnum.SUCCESS
            : item.status === ContentImportItemStatusEnum.FAILED
              ? ComicArchiveImportItemStatusEnum.FAILED
              : ComicArchiveImportItemStatusEnum.PENDING,
        message: item.lastErrorMessage ?? '',
      })),
      confirmedChapterIds: items
        .map((item) => item.localChapterId ?? item.targetChapterId)
        .filter((chapterId): chapterId is number => typeof chapterId === 'number'),
      startedAt: workflowJob.startedAt,
      finishedAt: workflowJob.finishedAt,
      expiresAt:
        workflowJob.expiresAt ??
        new Date(workflowJob.createdAt.getTime() + ARCHIVE_TASK_TTL_MS),
      lastError:
        typeof (workflowJob.summary as Record<string, unknown> | null)?.errorMessage === 'string'
          ? ((workflowJob.summary as Record<string, unknown>).errorMessage as string)
          : null,
      summary: {
        matchedChapterCount: previewItems.filter((item) => item.status === 1).length,
        ignoredItemCount: previewItems.filter((item) => item.status === 2).length,
        imageCount: importJob.imageTotal,
        successCount: importJob.successItemCount,
        failureCount: importJob.failedItemCount,
      },
      createdAt: workflowJob.createdAt,
      updatedAt: workflowJob.updatedAt,
    }
  }

  // 执行压缩包导入 workflow attempt。
  async executeArchiveWorkflow(context: WorkflowExecutionContext) {
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(
        context.jobId,
      )
    const items = await this.contentImportService.listExecutableItems(
      context.jobId,
      context.attemptNo,
    )
    const record = {
      assertStillOwned: context.assertStillOwned,
      attemptId: context.attemptId,
      itemId: '',
      jobId: context.jobId,
      workId: importJob.workId ?? 0,
    }

    for (const item of items) {
      await context.assertNotCancelled()
      await this.contentImportService.startItemAttempt(
        context.jobId,
        context.attemptId,
        item.itemId,
      )
      const matchedItem = item.metadata as unknown as ComicArchiveMatchedItemRecord
      try {
        await this.cleanupPendingUploadedFileResidues(context.jobId, item.itemId)
        const contents = await this.importChapter(
          { ...record, itemId: item.itemId },
          matchedItem,
        )
        await context.assertStillOwned()
        await this.contentImportService.markItemSuccess({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          localChapterId: matchedItem.chapterId,
          imageTotal: matchedItem.imageCount,
          imageSuccessCount: contents.length,
        })
      } catch (error) {
        await context.assertStillOwned()
        await this.contentImportService.markItemFailed({
          itemId: item.itemId,
          attemptNo: context.attemptNo,
          errorCode: 'ARCHIVE_CHAPTER_IMPORT_FAILED',
          errorMessage: this.stringifyError(error),
          imageTotal: matchedItem.imageCount,
          imageSuccessCount: 0,
        })
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

  // 校验压缩包预解析 workflow 仍处于草稿态。
  private async assertArchiveDraftOpen(jobId: string, workId?: number) {
    const workflowJob = await this.readWorkflowJob(jobId)
    if (workflowJob.status !== WorkflowJobStatusEnum.DRAFT) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '压缩包导入草稿已关闭，请重新创建导入会话',
      )
    }
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(jobId)
    if (
      importJob.sourceType !== ContentImportSourceTypeEnum.ARCHIVE_IMPORT ||
      (workId !== undefined && importJob.workId !== workId)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '压缩包导入会话与当前作品不匹配',
      )
    }
    return { importJob, workflowJob }
  }

  // 在事务内锁住草稿 workflow，避免 discard 与迟到 preview 并发写入。
  private async lockArchiveDraft(jobId: string, workId: number, tx: Db) {
    const now = new Date()
    const [workflowJob] = await tx
      .update(this.workflowJob)
      .set({ updatedAt: now })
      .where(
        and(
          eq(this.workflowJob.jobId, jobId),
          eq(this.workflowJob.status, WorkflowJobStatusEnum.DRAFT),
        ),
      )
      .returning()
    if (!workflowJob) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '压缩包导入草稿已关闭，请重新创建导入会话',
      )
    }
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(jobId, tx)
    if (
      importJob.sourceType !== ContentImportSourceTypeEnum.ARCHIVE_IMPORT ||
      importJob.workId !== workId
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '压缩包导入会话与当前作品不匹配',
      )
    }
    return { importJob, workflowJob }
  }

  // 将 workflow 状态映射为压缩包导入视图状态。
  private toArchiveStatus(status: WorkflowJobStatusEnum) {
    if (status === WorkflowJobStatusEnum.DRAFT) {
      return ComicArchiveTaskStatusEnum.DRAFT
    }
    if (status === WorkflowJobStatusEnum.PENDING) {
      return ComicArchiveTaskStatusEnum.PENDING
    }
    if (status === WorkflowJobStatusEnum.RUNNING) {
      return ComicArchiveTaskStatusEnum.PROCESSING
    }
    if (status === WorkflowJobStatusEnum.SUCCESS) {
      return ComicArchiveTaskStatusEnum.SUCCESS
    }
    if (status === WorkflowJobStatusEnum.PARTIAL_FAILED) {
      return ComicArchiveTaskStatusEnum.PARTIAL_FAILED
    }
    if (status === WorkflowJobStatusEnum.CANCELLED) {
      return ComicArchiveTaskStatusEnum.CANCELLED
    }
    if (status === WorkflowJobStatusEnum.EXPIRED) {
      return ComicArchiveTaskStatusEnum.EXPIRED
    }
    return ComicArchiveTaskStatusEnum.FAILED
  }

  // 导入单个章节图片，并用上传后的图片路径整体覆盖章节内容。
  private async importChapter(
    record: ArchiveWorkflowImportRecord,
    matchedItem: ComicArchiveMatchedItemRecord,
  ) {
    const contents: string[] = []
    const uploadedFiles: Array<{
      residueId?: string
      target: UploadDeleteTarget
    }> = []
    let contentPersisted = false

    try {
      for (const [index, imagePath] of matchedItem.imagePaths.entries()) {
        await record.assertStillOwned()
        const uploadedFile =
          await this.uploadService.uploadLocalFileWithDeleteTarget({
            localPath: imagePath,
            originalName: basename(imagePath),
            finalName: String(index + 1).padStart(3, '0'),
            objectKeySegments: [
              'comic',
              record.workId.toString(),
              'chapter',
              matchedItem.chapterId.toString(),
              record.jobId,
              record.attemptId,
            ],
          })
        const uploadedRecord: {
          residueId?: string
          target: UploadDeleteTarget
        } = { target: uploadedFile.deleteTarget }
        uploadedFiles.push(uploadedRecord)
        uploadedRecord.residueId =
          await this.contentImportService.recordUploadedFileResidue({
            attemptId: record.attemptId,
            deleteTarget: uploadedFile.deleteTarget,
            itemId: record.itemId,
            jobId: record.jobId,
          })
        contents.push(uploadedFile.upload.filePath)
      }

      await record.assertStillOwned()
      const residueIds = uploadedFiles
        .map((item) => item.residueId)
        .filter((residueId): residueId is string => Boolean(residueId))
      await this.drizzle.withTransaction(
        async (tx) => {
          const updateResult = await tx
            .update(this.workChapter)
            .set({ content: JSON.stringify(contents) })
            .where(
              and(
                eq(this.workChapter.id, matchedItem.chapterId),
                eq(this.workChapter.workId, record.workId),
                isNull(this.workChapter.deletedAt),
              ),
            )
          this.drizzle.assertAffectedRows(updateResult, '章节不存在')
          await this.contentImportService.markResiduesCleaned(residueIds, tx)
        },
        { notFound: '章节不存在' },
      )
      contentPersisted = true
      return contents
    } catch (error) {
      if (!contentPersisted) {
        await this.cleanupUploadedFiles(uploadedFiles)
      }
      throw error
    }
  }

  // 删除本章节失败前已经上传的图片，保证章节失败不会留下部分外部文件。
  private async cleanupUploadedFiles(
    uploadedFiles: Array<{ residueId?: string, target: UploadDeleteTarget }>,
  ) {
    const cleanupFailures: string[] = []
    for (const uploadedFile of uploadedFiles.reverse()) {
      try {
        await this.uploadService.deleteUploadedFile(uploadedFile.target)
        if (uploadedFile.residueId) {
          await this.contentImportService.markResiduesCleaned([
            uploadedFile.residueId,
          ])
        }
      } catch (error) {
        cleanupFailures.push(
          `${uploadedFile.target.provider}:${uploadedFile.target.filePath} (${this.stringifyError(
            error,
          )})`,
        )
        if (uploadedFile.residueId) {
          await this.contentImportService
            .markResidueCleanupFailed(uploadedFile.residueId, this.stringifyError(error))
            .catch(() => undefined)
        }
      }
    }
    if (cleanupFailures.length > 0) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        `章节导入失败且存在无法清理的部分上传文件: ${cleanupFailures.join(', ')}`,
      )
    }
  }

  // 根据解压后的根目录结构构建单章节或多章节预览结果。
  private async buildPreviewResult(
    input: PreviewComicArchiveDto,
    archiveName: string,
    extractDir: string,
    chapters: ComicArchivePreviewChapter[],
  ) {
    const chapterMap = new Map(chapters.map((chapter) => [chapter.id, chapter]))
    const rootEntries = await fs.readdir(extractDir, { withFileTypes: true })
    const visibleRootEntries = rootEntries.filter(
      (entry) => !this.shouldAutoIgnoreName(entry.name),
    )
    const rootDirs = visibleRootEntries.filter((entry) => entry.isDirectory())
    const mode =
      rootDirs.length > 0
        ? ComicArchivePreviewModeEnum.MULTI_CHAPTER
        : ComicArchivePreviewModeEnum.SINGLE_CHAPTER

    if (mode === ComicArchivePreviewModeEnum.MULTI_CHAPTER) {
      return this.buildMultiChapterPreview(
        extractDir,
        visibleRootEntries,
        chapterMap,
      )
    }

    return this.buildSingleChapterPreview(
      input,
      archiveName,
      extractDir,
      visibleRootEntries,
      chapterMap,
    )
  }

  // 构建多章节压缩包预览，每个一级目录对应一个章节 ID。
  private async buildMultiChapterPreview(
    extractDir: string,
    rootEntries: Dirent[],
    chapterMap: ComicArchivePreviewChapterMap,
  ) {
    const matchedItems: ComicArchiveMatchedItemRecord[] = []
    const ignoredItems: ComicArchiveIgnoredItemSnapshot[] = []

    for (const entry of rootEntries) {
      if (entry.isFile()) {
        ignoredItems.push({
          path: entry.name,
          reason: ComicArchiveIgnoreReasonEnum.NESTED_DIRECTORY_IGNORED,
          message: `多章节压缩包只识别一级章节目录，根目录文件 ${entry.name} 已忽略。`,
        })
        continue
      }

      if (!entry.isDirectory()) {
        continue
      }

      if (!CHAPTER_ID_DIRECTORY_RE.test(entry.name)) {
        ignoredItems.push({
          path: entry.name,
          reason: ComicArchiveIgnoreReasonEnum.INVALID_CHAPTER_ID_DIR,
          message: `目录 ${entry.name} 不是有效的章节 ID，已忽略。多章节压缩包只支持使用章节 ID 作为一级目录名。`,
        })
        continue
      }

      const chapterId = Number(entry.name)
      const chapter = chapterMap.get(chapterId)
      if (!chapter) {
        ignoredItems.push({
          path: entry.name,
          reason: ComicArchiveIgnoreReasonEnum.CHAPTER_NOT_FOUND,
          message: `目录 ${entry.name} 对应的章节不存在，或不属于当前作品，已忽略。`,
        })
        continue
      }

      const dirPath = join(extractDir, entry.name)
      const childEntries = await fs.readdir(dirPath, { withFileTypes: true })
      const imagePaths = this.collectImmediateImagePaths(
        dirPath,
        childEntries,
        ignoredItems,
        entry.name,
      )

      if (imagePaths.length === 0) {
        ignoredItems.push({
          path: entry.name,
          reason: ComicArchiveIgnoreReasonEnum.INVALID_IMAGE_FILE,
          message: `目录 ${entry.name} 下没有可导入的图片文件，已忽略。`,
        })
        continue
      }

      matchedItems.push(this.buildMatchedItem(entry.name, chapter, imagePaths))
    }

    return {
      mode: ComicArchivePreviewModeEnum.MULTI_CHAPTER,
      matchedItems,
      ignoredItems,
    }
  }

  // 构建单章节压缩包预览，仅扫描根目录下的图片文件。
  private async buildSingleChapterPreview(
    input: PreviewComicArchiveDto,
    archiveName: string,
    extractDir: string,
    rootEntries: Dirent[],
    chapterMap: ComicArchivePreviewChapterMap,
  ) {
    const matchedItems: ComicArchiveMatchedItemRecord[] = []
    const ignoredItems: ComicArchiveIgnoredItemSnapshot[] = []

    for (const entry of rootEntries) {
      if (entry.isDirectory()) {
        ignoredItems.push({
          path: entry.name,
          reason: ComicArchiveIgnoreReasonEnum.NESTED_DIRECTORY_IGNORED,
          message: `单章节压缩包只扫描根目录图片，目录 ${entry.name} 已忽略。`,
        })
      }
    }

    const imagePaths = rootEntries
      .filter((entry) => entry.isFile() && this.isAllowedImageFile(entry.name))
      .map((entry) => join(extractDir, entry.name))
      .sort((left, right) => this.compareImagePathName(left, right))

    if (!input.chapterId) {
      ignoredItems.push({
        path: archiveName,
        reason: ComicArchiveIgnoreReasonEnum.MISSING_CHAPTER_ID,
        message: '缺少章节 ID，无法导入单章节压缩包。',
      })
      return {
        mode: ComicArchivePreviewModeEnum.SINGLE_CHAPTER,
        matchedItems,
        ignoredItems,
      }
    }

    const chapter = chapterMap.get(input.chapterId)
    if (!chapter) {
      ignoredItems.push({
        path: archiveName,
        reason: ComicArchiveIgnoreReasonEnum.CHAPTER_NOT_FOUND,
        message: `章节 ${input.chapterId} 不存在，或不属于当前作品，已忽略。`,
      })
      return {
        mode: ComicArchivePreviewModeEnum.SINGLE_CHAPTER,
        matchedItems,
        ignoredItems,
      }
    }

    if (imagePaths.length === 0) {
      ignoredItems.push({
        path: archiveName,
        reason: ComicArchiveIgnoreReasonEnum.INVALID_IMAGE_FILE,
        message: '压缩包内没有可导入的图片文件，已忽略。',
      })
      return {
        mode: ComicArchivePreviewModeEnum.SINGLE_CHAPTER,
        matchedItems,
        ignoredItems,
      }
    }

    matchedItems.push(this.buildMatchedItem(archiveName, chapter, imagePaths))

    return {
      mode: ComicArchivePreviewModeEnum.SINGLE_CHAPTER,
      matchedItems,
      ignoredItems,
    }
  }

  // 收集当前目录下允许导入的图片路径，嵌套目录只记录为忽略项。
  private collectImmediateImagePaths(
    dirPath: string,
    entries: Dirent[],
    ignoredItems: ComicArchiveIgnoredItemSnapshot[],
    dirName: string,
  ) {
    const imagePaths = entries
      .filter((entry) => !this.shouldAutoIgnoreName(entry.name))
      .flatMap((entry) => {
        if (entry.isDirectory()) {
          ignoredItems.push({
            path: `${dirName}/${entry.name}`,
            reason: ComicArchiveIgnoreReasonEnum.NESTED_DIRECTORY_IGNORED,
            message: `检测到超过允许层级的目录 ${dirName}/${entry.name}，系统不会继续扫描更深层目录，已忽略。`,
          })
          return []
        }

        if (!entry.isFile() || !this.isAllowedImageFile(entry.name)) {
          return []
        }

        return [join(dirPath, entry.name)]
      })

    return imagePaths.sort((left, right) =>
      this.compareImagePathName(left, right),
    )
  }

  // 按文件名自然排序图片路径，保证 2.jpg 排在 10.jpg 之前。
  private compareImagePathName(left: string, right: string) {
    return basename(left).localeCompare(basename(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  }

  // 构建 matched Item。
  private buildMatchedItem(
    path: string,
    chapter: ComicArchivePreviewChapter,
    imagePaths: string[],
  ): ComicArchiveMatchedItemRecord {
    const existingContents = this.parseChapterContents(chapter.content)
    const existingImageCount = existingContents.length
    const hasExistingContent = existingImageCount > 0

    return {
      path,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      imageCount: imagePaths.length,
      hasExistingContent,
      existingImageCount,
      importMode: 'replace',
      message: `目录 ${path} 已匹配到章节 ${chapter.id}，可在确认后导入。`,
      warningMessage: hasExistingContent
        ? `章节 ${chapter.id} 当前已有 ${existingImageCount} 张图片。确认导入后会用压缩包内容整体覆盖，旧资源首版不会自动删除。`
        : '',
      imagePaths,
    }
  }

  // 解析章节已有漫画图片列表，脏数据按空列表处理。
  private parseChapterContents(content: string | null) {
    if (!content) {
      return []
    }

    const parsed = jsonParse(content, [])
    return Array.isArray(parsed) ? parsed : []
  }

  // 解压 zip 到任务临时目录，并拒绝绝对路径或目录穿越。
  private async extractArchive(archivePath: string, extractDir: string) {
    try {
      const zip = await unzipper.Open.file(archivePath)
      for (const entry of zip.files) {
        const entryPath = entry.path.split('\\').join('/')
        if (!entryPath || this.shouldAutoIgnoreArchivePath(entryPath)) {
          continue
        }

        const safeSegments = this.normalizeArchiveSegments(entryPath)
        if (safeSegments.length === 0) {
          continue
        }

        const targetPath = join(extractDir, ...safeSegments)
        if (entry.type === 'Directory') {
          await fs.mkdir(targetPath, { recursive: true })
          continue
        }

        await fs.mkdir(dirname(targetPath), { recursive: true })
        await pipeline(entry.stream(), createWriteStream(targetPath))
      }
    } catch {
      throw new BadRequestException('压缩包解析失败')
    }
  }

  // 判断压缩包路径是否属于系统目录或隐藏文件。
  private shouldAutoIgnoreArchivePath(entryPath: string) {
    return entryPath
      .split('/')
      .some(
        (segment) =>
          AUTO_IGNORED_ENTRY_NAMES.has(segment) || segment.startsWith('.'),
      )
  }

  // 归一化压缩包条目路径分段，防止绝对路径和目录穿越。
  private normalizeArchiveSegments(entryPath: string) {
    if (entryPath.startsWith('/') || WINDOWS_ABSOLUTE_PATH_RE.test(entryPath)) {
      throw new BadRequestException('压缩包路径不合法')
    }

    const segments = entryPath
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)

    if (segments.some((segment) => segment === '.' || segment === '..')) {
      throw new BadRequestException('压缩包路径不合法')
    }

    return segments
  }

  // 判断文件扩展名是否属于当前上传配置允许的图片类型。
  private isAllowedImageFile(fileName: string) {
    const normalizedExt = extname(fileName).toLowerCase().slice(1)
    return Boolean(
      normalizedExt &&
      this.uploadConfig.allowExtensions.image.includes(normalizedExt),
    )
  }

  // 判断文件或目录名是否应在预览中自动忽略。
  private shouldAutoIgnoreName(name: string) {
    return AUTO_IGNORED_ENTRY_NAMES.has(name) || name.startsWith('.')
  }

  // 加载 work Chapters。
  private async loadWorkChapters(workId: number) {
    return this.db.query.workChapter.findMany({
      where: {
        workId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        title: true,
        content: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })
  }

  // 执行 assertWorkExists。
  private async assertWorkExists(workId: number) {
    if (
      !(await this.drizzle.ext.exists(
        this.work,
        and(eq(this.work.id, workId), isNull(this.work.deletedAt)),
      ))
    ) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '作品不存在',
      )
    }
  }

  // 获取 task Root Dir。
  private getTaskRootDir() {
    return join(this.uploadConfig.tmpDir, 'comic-archive-import')
  }

  // 获取 workflow job 临时目录。
  private getTaskDir(jobId: string) {
    return join(this.getTaskRootDir(), jobId)
  }

  // 获取 workflow job 解压目录。
  private getTaskExtractDir(jobId: string) {
    return join(this.getTaskDir(jobId), 'extract')
  }

  // 清理 workflow 归属的本地临时资源，并清空内容导入任务上的可重试资源路径。
  private async cleanupWorkflowJobResources(jobId: string) {
    const importJob =
      await this.contentImportService.readContentImportJobByWorkflowJobId(jobId)
    await this.cleanupPendingUploadedFileResidues(jobId)
    await this.removeTaskDir(jobId)
    await this.db
      .update(this.contentImportJob)
      .set({
        archivePath: null,
        extractPath: null,
        updatedAt: new Date(),
      })
      .where(eq(this.contentImportJob.id, importJob.id))
  }

  // 清理失败/取消后仍处于 pending 的外部上传文件残留。
  private async cleanupPendingUploadedFileResidues(jobId: string, itemId?: string) {
    const residues =
      await this.contentImportService.listPendingUploadedFileResidues(jobId, {
        itemId,
      })
    const cleanupFailures: string[] = []
    for (const residue of residues.reverse()) {
      try {
        await this.uploadService.deleteUploadedFile(residue.deleteTarget)
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

  // 删除 workflow job 临时目录。
  private async removeTaskDir(jobId: string) {
    await fs.rm(this.getTaskDir(jobId), {
      recursive: true,
      force: true,
    })
  }

  // 执行 stringifyError。
  private stringifyError<T>(error: T) {
    if (error instanceof Error) {
      return error.message
    }

    if (typeof error === 'string') {
      return error
    }

    try {
      return JSON.stringify(error)
    } catch {
      return '未知错误'
    }
  }

  // 消费 stream。
  private async consumeStream(stream: NodeJS.ReadableStream) {
    return new Promise<void>((resolve) => {
      stream.on('end', resolve)
      stream.on('error', resolve)
      stream.resume()
    })
  }
}
