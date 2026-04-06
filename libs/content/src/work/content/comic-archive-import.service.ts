import type { WorkComicArchiveImportTaskSelect } from '@db/schema'
import type { UploadConfigInterface } from '@libs/platform/config/upload.types';
import type { FastifyRequest } from 'fastify'
import type { Dirent } from 'node:fs'
import type {
  ComicArchiveIgnoredItemView,
  ComicArchiveMatchedItemRecord,
  ComicArchiveResultItemView,
  ComicArchiveSummaryView,
  ComicArchiveTaskRecord,
  ComicArchiveTaskView,
} from './comic-archive-import.type'
import { createWriteStream, promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import {
  DrizzleService,
} from '@db/core'
import { UploadService } from '@libs/platform/modules/upload/upload.service';
import { jsonParse } from '@libs/platform/utils/jsonParse';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, asc, eq, inArray, isNull, lt, lte } from 'drizzle-orm'
import * as unzipper from 'unzipper'
import { v4 as uuidv4 } from 'uuid'
import {
  ComicArchiveIgnoreReasonEnum,
  ComicArchiveImportItemStatusEnum,
  ComicArchivePreviewModeEnum,
  ComicArchiveTaskStatusEnum,
} from './comic-archive-import.type'
import {
  ComicArchiveTaskIdDto,
  ComicArchiveTaskResponseDto,
  ConfirmComicArchiveDto,
  PreviewComicArchiveDto,
} from './dto/content.dto'

const ARCHIVE_EXTENSION = '.zip'
const ARCHIVE_TASK_TTL_MS = 24 * 60 * 60 * 1000
const ARCHIVE_TASK_CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000
const AUTO_IGNORED_ENTRY_NAMES = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db'])
const CHAPTER_ID_DIRECTORY_RE = /^\d+$/
const WINDOWS_ABSOLUTE_PATH_RE = /^[a-z]:/i
const TERMINAL_TASK_STATUSES = [
  ComicArchiveTaskStatusEnum.SUCCESS,
  ComicArchiveTaskStatusEnum.PARTIAL_FAILED,
  ComicArchiveTaskStatusEnum.FAILED,
  ComicArchiveTaskStatusEnum.EXPIRED,
  ComicArchiveTaskStatusEnum.CANCELLED,
] as const

/**
 * 漫画压缩包导入服务。
 * 负责预解析 zip、生成前端确认结果，以及驱动确认后的后台导入执行。
 */
@Injectable()
export class ComicArchiveImportService {
  private readonly logger = new Logger(ComicArchiveImportService.name)
  private readonly uploadConfig: UploadConfigInterface

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {
    this.uploadConfig = this.configService.get<UploadConfigInterface>('upload')!
  }

  private get db() {
    return this.drizzle.db
  }

  private get work() {
    return this.drizzle.schema.work
  }

  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  private get workComicArchiveImportTask() {
    return this.drizzle.schema.workComicArchiveImportTask
  }

  /**
   * 预解析漫画压缩包并返回前端确认结果。
   * 预解析阶段只产出草稿任务，不会写章节内容，也不会上传页面图片到最终 provider。
   */
  async previewArchive(
    req: FastifyRequest,
    input: PreviewComicArchiveDto,
  ): Promise<ComicArchiveTaskResponseDto> {
    await this.assertWorkExists(input.workId)

    const archiveFile = await req.file()
    if (!archiveFile) {
      throw new BadRequestException('上传文件不能为空')
    }

    if (extname(archiveFile.filename).toLowerCase() !== ARCHIVE_EXTENSION) {
      await this.consumeStream(archiveFile.file)
      throw new BadRequestException('仅支持 zip 压缩包')
    }

    const taskId = uuidv4()
    const taskDir = this.getTaskDir(taskId)
    const extractDir = this.getTaskExtractDir(taskId)
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
      const record: ComicArchiveTaskRecord = {
        taskId,
        workId: input.workId,
        mode: previewResult.mode,
        status: ComicArchiveTaskStatusEnum.DRAFT,
        archiveName: archiveFile.filename,
        archivePath,
        extractPath: extractDir,
        requireConfirm: previewResult.matchedItems.length > 0,
        summary: {
          matchedChapterCount: previewResult.matchedItems.length,
          ignoredItemCount: previewResult.ignoredItems.length,
          imageCount: previewResult.matchedItems.reduce(
            (sum, item) => sum + item.imageCount,
            0,
          ),
        },
        matchedItems: previewResult.matchedItems,
        ignoredItems: previewResult.ignoredItems,
        resultItems: [],
        confirmedChapterIds: [],
        startedAt: null,
        finishedAt: null,
        expiresAt: new Date(now.getTime() + ARCHIVE_TASK_TTL_MS),
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }

      await this.createTaskRecord(record)
      return this.toTaskView(record)
    } catch (error) {
      await fs.rm(taskDir, { recursive: true, force: true }).catch(() => undefined)

      if (error instanceof BadRequestException || error instanceof PayloadTooLargeException) {
        throw error
      }
      throw new BadRequestException('压缩包预解析失败')
    }
  }

  /**
   * 确认漫画压缩包导入任务。
   * 用户确认后仅把草稿任务推进到 pending，由后台 worker 执行正式导入。
   */
  async confirmArchive(input: ConfirmComicArchiveDto) {
    const draftRecord = await this.readTaskRecord(input.taskId)
    const record = await this.assertDraftTaskAvailable(draftRecord)

    const confirmedChapterIds = [...new Set(input.confirmedChapterIds)]
    if (confirmedChapterIds.length === 0) {
      throw new BadRequestException('请至少确认一个可导入章节')
    }

    const matchedChapterIds = new Set(record.matchedItems.map(item => item.chapterId))
    if (confirmedChapterIds.some(chapterId => !matchedChapterIds.has(chapterId))) {
      throw new BadRequestException('存在未通过预解析确认的章节')
    }

    record.confirmedChapterIds = confirmedChapterIds
    record.status = ComicArchiveTaskStatusEnum.PENDING
    record.updatedAt = new Date()
    await this.updateTaskRecord(record)
    return true
  }

  /**
   * 查询漫画压缩包导入任务详情。
   * 前端可用该接口轮询预解析草稿和后台导入执行状态。
   */
  async getArchiveDetail(input: ComicArchiveTaskIdDto) {
    const record = await this.readTaskRecord(input.taskId)
    const latestRecord = await this.refreshExpiredDraftTask(record)
    return this.toTaskView(latestRecord)
  }

  /**
   * 消费待处理的漫画压缩包导入任务。
   * 任务元数据统一走数据库持久化，worker 只依赖 taskId 定位本地临时目录。
   */
  async consumePendingTasks() {
    await this.cleanupTasks()

    while (true) {
      const record = await this.claimNextPendingTask()
      if (!record) {
        break
      }
      await this.processTask(record)
    }
  }

  private async processTask(record: ComicArchiveTaskRecord) {
    let successCount = 0
    let failureCount = 0
    let lastError: string | null = null

    try {
      for (const chapterId of record.confirmedChapterIds) {
        const matchedItem = record.matchedItems.find(item => item.chapterId === chapterId)
        if (!matchedItem) {
          continue
        }

        try {
          const uploadedContents = await this.importChapter(record, matchedItem)
          record.resultItems.push({
            chapterId: matchedItem.chapterId,
            chapterTitle: matchedItem.chapterTitle,
            importedImageCount: uploadedContents.length,
            status: ComicArchiveImportItemStatusEnum.SUCCESS,
            message: `章节 ${matchedItem.chapterId} 导入成功`,
          })
          successCount += 1
        } catch (error) {
          const message = this.stringifyError(error)
          record.resultItems.push({
            chapterId: matchedItem.chapterId,
            chapterTitle: matchedItem.chapterTitle,
            importedImageCount: 0,
            status: ComicArchiveImportItemStatusEnum.FAILED,
            message,
          })
          lastError = message
          failureCount += 1
          this.logger.error(
            `comic_archive_import_failed taskId=${record.taskId} chapterId=${matchedItem.chapterId} error=${message}`,
          )
        }

        record.updatedAt = new Date()
        record.lastError = lastError
        await this.updateTaskRecord(record)
      }

      record.finishedAt = new Date()
      record.updatedAt = record.finishedAt
      record.lastError = lastError

      if (failureCount === 0) {
        record.status = ComicArchiveTaskStatusEnum.SUCCESS
      } else if (successCount === 0) {
        record.status = ComicArchiveTaskStatusEnum.FAILED
      } else {
        record.status = ComicArchiveTaskStatusEnum.PARTIAL_FAILED
      }

      await this.updateTaskRecord(record)
    } catch (error) {
      const message = this.stringifyError(error)
      record.status = ComicArchiveTaskStatusEnum.FAILED
      record.finishedAt = new Date()
      record.updatedAt = record.finishedAt
      record.lastError = message
      await this.safeUpdateTaskRecord(record)
      this.logger.error(`comic_archive_process_failed taskId=${record.taskId} error=${message}`)
    }
  }

  private async importChapter(
    record: ComicArchiveTaskRecord,
    matchedItem: ComicArchiveMatchedItemRecord,
  ) {
    const contents: string[] = []

    for (const [index, imagePath] of matchedItem.imagePaths.entries()) {
      const uploadedFile = await this.uploadService.uploadLocalFile({
        localPath: imagePath,
        originalName: basename(imagePath),
        finalName: String(index + 1).padStart(3, '0'),
        objectKeySegments: [
          'comic',
          record.workId.toString(),
          'chapter',
          matchedItem.chapterId.toString(),
          record.taskId,
        ],
      })
      contents.push(uploadedFile.filePath)
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workChapter)
        .set({ content: JSON.stringify(contents) })
        .where(and(
          eq(this.workChapter.id, matchedItem.chapterId),
          eq(this.workChapter.workId, record.workId),
          isNull(this.workChapter.deletedAt),
        )),
    )
    this.drizzle.assertAffectedRows(result, '章节不存在')

    return contents
  }

  private async buildPreviewResult(
    input: PreviewComicArchiveDto,
    archiveName: string,
    extractDir: string,
    chapters: Array<{
      id: number
      title: string
      content: string | null
    }>,
  ) {
    const chapterMap = new Map(chapters.map(chapter => [chapter.id, chapter]))
    const rootEntries = await fs.readdir(extractDir, { withFileTypes: true })
    const visibleRootEntries = rootEntries.filter(
      entry => !this.shouldAutoIgnoreName(entry.name),
    )
    const rootDirs = visibleRootEntries.filter(entry => entry.isDirectory())
    const mode = rootDirs.length > 0
      ? ComicArchivePreviewModeEnum.MULTI_CHAPTER
      : ComicArchivePreviewModeEnum.SINGLE_CHAPTER

    if (mode === ComicArchivePreviewModeEnum.MULTI_CHAPTER) {
      return this.buildMultiChapterPreview(extractDir, rootEntries, chapterMap)
    }

    return this.buildSingleChapterPreview(
      input,
      archiveName,
      extractDir,
      rootEntries,
      chapterMap,
    )
  }

  private async buildMultiChapterPreview(
    extractDir: string,
    rootEntries: Dirent[],
    chapterMap: Map<number, { id: number, title: string, content: string | null }>,
  ) {
    const matchedItems: ComicArchiveMatchedItemRecord[] = []
    const ignoredItems: ComicArchiveIgnoredItemView[] = []

    const visibleRootEntries = rootEntries.filter(
      entry => !this.shouldAutoIgnoreName(entry.name),
    )

    for (const entry of visibleRootEntries) {
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

  private async buildSingleChapterPreview(
    input: PreviewComicArchiveDto,
    archiveName: string,
    extractDir: string,
    rootEntries: Dirent[],
    chapterMap: Map<number, { id: number, title: string, content: string | null }>,
  ) {
    const matchedItems: ComicArchiveMatchedItemRecord[] = []
    const ignoredItems: ComicArchiveIgnoredItemView[] = []
    const visibleRootEntries = rootEntries.filter(
      entry => !this.shouldAutoIgnoreName(entry.name),
    )

    for (const entry of visibleRootEntries) {
      if (entry.isDirectory()) {
        ignoredItems.push({
          path: entry.name,
          reason: ComicArchiveIgnoreReasonEnum.NESTED_DIRECTORY_IGNORED,
          message: `单章节压缩包只扫描根目录图片，目录 ${entry.name} 已忽略。`,
        })
      }
    }

    const imagePaths = visibleRootEntries
      .filter(entry => entry.isFile() && this.isAllowedImageFile(entry.name))
      .map(entry => join(extractDir, entry.name))
      .sort((left, right) =>
        basename(left).localeCompare(basename(right), undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      )

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

    matchedItems.push(
      this.buildMatchedItem(archiveName, chapter, imagePaths),
    )

    return {
      mode: ComicArchivePreviewModeEnum.SINGLE_CHAPTER,
      matchedItems,
      ignoredItems,
    }
  }

  private collectImmediateImagePaths(
    dirPath: string,
    entries: Dirent[],
    ignoredItems: ComicArchiveIgnoredItemView[],
    dirName: string,
  ) {
    const imagePaths = entries
      .filter(entry => !this.shouldAutoIgnoreName(entry.name))
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
      basename(left).localeCompare(basename(right), undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )
  }

  private buildMatchedItem(
    path: string,
    chapter: { id: number, title: string, content: string | null },
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

  private parseChapterContents(content: string | null) {
    if (!content) {
      return []
    }

    const parsed = jsonParse(content, [])
    return Array.isArray(parsed) ? parsed : []
  }

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

  private shouldAutoIgnoreArchivePath(entryPath: string) {
    return entryPath
      .split('/')
      .some(segment => AUTO_IGNORED_ENTRY_NAMES.has(segment) || segment.startsWith('.'))
  }

  private normalizeArchiveSegments(entryPath: string) {
    if (entryPath.startsWith('/') || WINDOWS_ABSOLUTE_PATH_RE.test(entryPath)) {
      throw new BadRequestException('压缩包路径不合法')
    }

    const segments = entryPath
      .split('/')
      .map(segment => segment.trim())
      .filter(Boolean)

    if (segments.some(segment => segment === '.' || segment === '..')) {
      throw new BadRequestException('压缩包路径不合法')
    }

    return segments
  }

  private isAllowedImageFile(fileName: string) {
    const ext = extname(fileName).toLowerCase()
    const normalizedExt = ext.startsWith('.') ? ext.slice(1) : ext
    return Boolean(
      normalizedExt &&
      this.uploadConfig.allowExtensions.image.includes(normalizedExt),
    )
  }

  private shouldAutoIgnoreName(name: string) {
    return AUTO_IGNORED_ENTRY_NAMES.has(name) || name.startsWith('.')
  }

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

  private async assertWorkExists(workId: number) {
    if (
      !(await this.drizzle.ext.exists(
        this.work,
        and(eq(this.work.id, workId), isNull(this.work.deletedAt)),
      ))
    ) {
      throw new BadRequestException('作品不存在')
    }
  }

  private async assertDraftTaskAvailable(record: ComicArchiveTaskRecord) {
    const latestRecord = await this.refreshExpiredDraftTask(record)
    if (latestRecord.status === ComicArchiveTaskStatusEnum.EXPIRED) {
      throw new BadRequestException('预解析任务已过期，请重新上传压缩包')
    }

    if (latestRecord.status !== ComicArchiveTaskStatusEnum.DRAFT) {
      throw new BadRequestException('当前任务状态不允许确认导入')
    }

    return latestRecord
  }

  private async refreshExpiredDraftTask(record: ComicArchiveTaskRecord) {
    if (
      record.status !== ComicArchiveTaskStatusEnum.DRAFT
      || record.expiresAt.getTime() > Date.now()
    ) {
      return record
    }

    record.status = ComicArchiveTaskStatusEnum.EXPIRED
    record.updatedAt = new Date()
    await this.updateTaskRecord(record)
    return record
  }

  private toTaskView(record: ComicArchiveTaskRecord): ComicArchiveTaskView {
    return {
      taskId: record.taskId,
      workId: record.workId,
      mode: record.mode,
      status: record.status,
      requireConfirm: record.requireConfirm,
      summary: record.summary,
      matchedItems: record.matchedItems.map(({ imagePaths: _imagePaths, ...item }) => item),
      ignoredItems: record.ignoredItems,
      resultItems: record.resultItems,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      expiresAt: record.expiresAt,
      lastError: record.lastError,
    }
  }

  private async cleanupTasks() {
    const now = new Date()
    const retentionCutoff = new Date(now.getTime() - ARCHIVE_TASK_CLEANUP_RETENTION_MS)

    await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workComicArchiveImportTask)
        .set({
          status: ComicArchiveTaskStatusEnum.EXPIRED,
          updatedAt: now,
        })
        .where(and(
          eq(this.workComicArchiveImportTask.status, ComicArchiveTaskStatusEnum.DRAFT),
          lte(this.workComicArchiveImportTask.expiresAt, now),
        )),
    )

    const rows = await this.db
      .select({
        taskId: this.workComicArchiveImportTask.taskId,
      })
      .from(this.workComicArchiveImportTask)
      .where(and(
        inArray(this.workComicArchiveImportTask.status, [...TERMINAL_TASK_STATUSES]),
        lt(this.workComicArchiveImportTask.updatedAt, retentionCutoff),
      ))

    for (const row of rows) {
      await fs.rm(this.getTaskDir(row.taskId), {
        recursive: true,
        force: true,
      }).catch(() => undefined)
    }
  }

  private getTaskRootDir() {
    return join(this.uploadConfig.tmpDir, 'comic-archive-import')
  }

  private getTaskDir(taskId: string) {
    return join(this.getTaskRootDir(), taskId)
  }

  private getTaskExtractDir(taskId: string) {
    return join(this.getTaskDir(taskId), 'extract')
  }

  private async claimNextPendingTask() {
    const [pendingTask] = await this.db
      .select({
        taskId: this.workComicArchiveImportTask.taskId,
      })
      .from(this.workComicArchiveImportTask)
      .where(eq(this.workComicArchiveImportTask.status, ComicArchiveTaskStatusEnum.PENDING))
      .orderBy(asc(this.workComicArchiveImportTask.createdAt))
      .limit(1)

    if (!pendingTask) {
      return null
    }

    const now = new Date()
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workComicArchiveImportTask)
        .set({
          status: ComicArchiveTaskStatusEnum.PROCESSING,
          startedAt: now,
          finishedAt: null,
          resultItems: [],
          lastError: null,
          updatedAt: now,
        })
        .where(and(
          eq(this.workComicArchiveImportTask.taskId, pendingTask.taskId),
          eq(this.workComicArchiveImportTask.status, ComicArchiveTaskStatusEnum.PENDING),
        ))
        .returning(),
    )

    if (rows.length === 0) {
      return null
    }

    return this.toTaskRecord(rows[0])
  }

  private async createTaskRecord(record: ComicArchiveTaskRecord) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.workComicArchiveImportTask).values({
        taskId: record.taskId,
        ...this.buildTaskPersistValues(record),
        createdAt: record.createdAt,
      }),
    )
  }

  private async readTaskRecord(taskId: string) {
    const record = await this.tryReadTaskRecord(taskId)
    if (!record) {
      throw new NotFoundException('导入任务不存在')
    }
    return record
  }

  private async tryReadTaskRecord(taskId: string) {
    const [row] = await this.db
      .select()
      .from(this.workComicArchiveImportTask)
      .where(eq(this.workComicArchiveImportTask.taskId, taskId))
      .limit(1)

    return row ? this.toTaskRecord(row) : null
  }

  private async updateTaskRecord(record: ComicArchiveTaskRecord) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workComicArchiveImportTask)
        .set(this.buildTaskPersistValues(record))
        .where(eq(this.workComicArchiveImportTask.taskId, record.taskId)),
    )
    this.drizzle.assertAffectedRows(result, '导入任务不存在')
  }

  private async safeUpdateTaskRecord(record: ComicArchiveTaskRecord) {
    try {
      await this.updateTaskRecord(record)
    } catch (error) {
      const message = this.stringifyError(error)
      this.logger.error(`comic_archive_update_failed taskId=${record.taskId} error=${message}`)
    }
  }

  private buildTaskPersistValues(record: ComicArchiveTaskRecord) {
    return {
      workId: record.workId,
      mode: record.mode,
      status: record.status,
      archiveName: record.archiveName,
      archivePath: record.archivePath,
      extractPath: record.extractPath,
      requireConfirm: record.requireConfirm,
      summary: record.summary,
      matchedItems: record.matchedItems,
      ignoredItems: record.ignoredItems,
      resultItems: record.resultItems,
      confirmedChapterIds: record.confirmedChapterIds,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      expiresAt: record.expiresAt,
      lastError: record.lastError,
      updatedAt: record.updatedAt,
    }
  }

  /**
   * 把数据库行收敛成稳定的领域任务记录。
   * JSONB 字段会做最小归一化，避免脏数据直接透出到接口层。
   */
  private toTaskRecord(row: WorkComicArchiveImportTaskSelect): ComicArchiveTaskRecord {
    return {
      taskId: row.taskId,
      workId: row.workId,
      mode: this.normalizePreviewMode(row.mode),
      status: this.normalizeTaskStatus(row.status),
      archiveName: row.archiveName,
      archivePath: row.archivePath,
      extractPath: row.extractPath,
      requireConfirm: row.requireConfirm,
      summary: this.normalizeSummary(row.summary),
      matchedItems: this.normalizeMatchedItems(row.matchedItems),
      ignoredItems: this.normalizeIgnoredItems(row.ignoredItems),
      resultItems: this.normalizeResultItems(row.resultItems),
      confirmedChapterIds: this.normalizeConfirmedChapterIds(row.confirmedChapterIds),
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      expiresAt: row.expiresAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  private normalizeSummary(value: unknown): ComicArchiveSummaryView {
    const record = this.asObject(value)
    return {
      matchedChapterCount: this.asNumber(record?.matchedChapterCount),
      ignoredItemCount: this.asNumber(record?.ignoredItemCount),
      imageCount: this.asNumber(record?.imageCount),
    }
  }

  private normalizeIgnoredItems(value: unknown): ComicArchiveIgnoredItemView[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.map((item) => {
      const record = this.asObject(item)
      return {
        path: this.asString(record?.path),
        reason: this.normalizeIgnoreReason(record?.reason),
        message: this.asString(record?.message),
      }
    })
  }

  private normalizeMatchedItems(value: unknown): ComicArchiveMatchedItemRecord[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.map((item) => {
      const record = this.asObject(item)
      return {
        path: this.asString(record?.path),
        chapterId: this.asNumber(record?.chapterId),
        chapterTitle: this.asString(record?.chapterTitle),
        imageCount: this.asNumber(record?.imageCount),
        hasExistingContent: this.asBoolean(record?.hasExistingContent),
        existingImageCount: this.asNumber(record?.existingImageCount),
        importMode: 'replace',
        message: this.asString(record?.message),
        warningMessage: this.asString(record?.warningMessage),
        imagePaths: this.asStringArray(record?.imagePaths),
      }
    })
  }

  private normalizeResultItems(value: unknown): ComicArchiveResultItemView[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.map((item) => {
      const record = this.asObject(item)
      return {
        chapterId: this.asNumber(record?.chapterId),
        chapterTitle: this.asString(record?.chapterTitle),
        importedImageCount: this.asNumber(record?.importedImageCount),
        status: this.normalizeImportItemStatus(record?.status),
        message: this.asString(record?.message),
      }
    })
  }

  private normalizeConfirmedChapterIds(value: unknown) {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map(item => this.asNumber(item))
      .filter(chapterId => chapterId > 0)
  }

  private normalizeTaskStatus(value: unknown) {
    return Object.values(ComicArchiveTaskStatusEnum).includes(value as ComicArchiveTaskStatusEnum)
      ? value as ComicArchiveTaskStatusEnum
      : ComicArchiveTaskStatusEnum.DRAFT
  }

  private normalizePreviewMode(value: unknown) {
    return Object.values(ComicArchivePreviewModeEnum).includes(value as ComicArchivePreviewModeEnum)
      ? value as ComicArchivePreviewModeEnum
      : ComicArchivePreviewModeEnum.SINGLE_CHAPTER
  }

  private normalizeImportItemStatus(value: unknown) {
    return Object.values(ComicArchiveImportItemStatusEnum).includes(value as ComicArchiveImportItemStatusEnum)
      ? value as ComicArchiveImportItemStatusEnum
      : ComicArchiveImportItemStatusEnum.FAILED
  }

  private normalizeIgnoreReason(value: unknown) {
    return Object.values(ComicArchiveIgnoreReasonEnum).includes(value as ComicArchiveIgnoreReasonEnum)
      ? value as ComicArchiveIgnoreReasonEnum
      : ComicArchiveIgnoreReasonEnum.INVALID_IMAGE_FILE
  }

  private asObject(value: unknown) {
    return typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : null
  }

  private asString(value: unknown) {
    return typeof value === 'string' ? value : ''
  }

  private asNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : 0
  }

  private asBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : false
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  }

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
      return '未知错误'
    }
  }

  private async consumeStream(stream: NodeJS.ReadableStream) {
    return new Promise<void>((resolve) => {
      stream.on('end', resolve)
      stream.on('error', resolve)
      stream.resume()
    })
  }
}
