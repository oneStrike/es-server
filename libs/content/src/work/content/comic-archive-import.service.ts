import type {
  WorkComicArchiveImportPreviewSessionSelect,
  WorkComicArchiveImportTaskSelect,
} from '@db/schema'
import type { UploadConfigInterface } from '@libs/platform/config'
import type { FastifyRequest } from 'fastify'
import type { Dirent } from 'node:fs'
import type {
  ComicArchiveIgnoredItemSnapshot,
  ComicArchiveMatchedItemRecord,
  ComicArchivePreviewChapter,
  ComicArchivePreviewChapterMap,
  ComicArchivePreviewSessionRecord,
  ComicArchiveTaskRecord,
} from './comic-archive-import.type'
import { createWriteStream, promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { UploadService } from '@libs/platform/modules/upload/upload.service'
import { jsonParse } from '@libs/platform/utils'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
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
  ComicArchivePreviewSessionStatusEnum,
  ComicArchiveTaskStatusEnum,
} from './comic-archive-import.constant'
import {
  ComicArchiveIgnoredItemDto,
  ComicArchiveResultItemDto,
  ComicArchiveSummaryDto,
  ComicArchiveTaskIdDto,
  ComicArchiveTaskResponseDto,
  ConfirmComicArchiveDto,
  CreateComicArchiveSessionDto,
  DiscardComicArchiveDto,
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

  // 初始化 ComicArchiveImportService 依赖。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
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

  // 读取 workComicArchiveImportTask。
  private get workComicArchiveImportTask() {
    return this.drizzle.schema.workComicArchiveImportTask
  }

  // 读取 workComicArchiveImportPreviewSession。
  private get workComicArchiveImportPreviewSession() {
    return this.drizzle.schema.workComicArchiveImportPreviewSession
  }

  // 创建预解析会话，前端拿到 taskId 后再发起 multipart 预解析上传。
  async createPreviewSession(input: CreateComicArchiveSessionDto) {
    await this.assertWorkExists(input.workId)

    const now = new Date()
    const record: ComicArchivePreviewSessionRecord = {
      taskId: uuidv4(),
      workId: input.workId,
      chapterId: input.chapterId ?? null,
      status: ComicArchivePreviewSessionStatusEnum.OPEN,
      expiresAt: new Date(now.getTime() + ARCHIVE_TASK_TTL_MS),
      createdAt: now,
      updatedAt: now,
    }

    await this.createPreviewSessionRecord(record)
    return { taskId: record.taskId }
  }

  // 预解析漫画压缩包并返回前端确认结果，预解析阶段只产出草稿任务，不会写章节内容，也不会上传页面图片到最终 provider。
  async previewArchive(
    req: FastifyRequest,
    input: PreviewComicArchiveDto,
  ): Promise<ComicArchiveTaskResponseDto> {
    await this.assertWorkExists(input.workId)
    await this.assertOpenPreviewSessionMatches(input)

    const archiveFile = await req.file()
    if (!archiveFile) {
      throw new BadRequestException('上传文件不能为空')
    }

    if (extname(archiveFile.filename).toLowerCase() !== ARCHIVE_EXTENSION) {
      await this.consumeStream(archiveFile.file)
      throw new BadRequestException('仅支持 zip 压缩包')
    }

    const taskId = input.taskId
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

      await this.createTaskRecordIfSessionOpen(record)
      return this.toTaskView(record)
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

  // 确认漫画压缩包导入任务，用户确认后仅把草稿任务推进到 pending，由后台 worker 执行正式导入。
  async confirmArchive(input: ConfirmComicArchiveDto) {
    const draftRecord = await this.readTaskRecord(input.taskId)
    const record = await this.assertDraftTaskAvailable(draftRecord)

    const confirmedChapterIds = [...new Set(input.confirmedChapterIds)]
    if (confirmedChapterIds.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '请至少确认一个可导入章节',
      )
    }

    const matchedChapterIds = new Set(
      record.matchedItems.map((item) => item.chapterId),
    )
    if (
      confirmedChapterIds.some((chapterId) => !matchedChapterIds.has(chapterId))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '存在未通过预解析确认的章节',
      )
    }

    const pendingRecord: ComicArchiveTaskRecord = {
      ...record,
      confirmedChapterIds,
      status: ComicArchiveTaskStatusEnum.PENDING,
      updatedAt: new Date(),
    }
    const confirmed = await this.claimPreviewSessionForConfirm(pendingRecord)
    if (!confirmed) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '预解析会话已取消，请重新上传压缩包',
      )
    }
    return true
  }

  // 丢弃预确认漫画压缩包导入会话，成功前必须先移除本地临时目录，再硬删除草稿和会话标记。
  async discardArchivePreview(input: DiscardComicArchiveDto) {
    const claimedSession = await this.claimPreviewSessionForDiscard(
      input.taskId,
    )
    const record = await this.tryReadTaskRecord(input.taskId)

    if (!claimedSession && !record) {
      return true
    }

    if (record && !this.canDiscardTaskRecord(record)) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '已确认的导入任务不允许丢弃',
      )
    }

    await this.removeTaskDir(input.taskId)
    await this.deletePreConfirmResidue(input.taskId)
    return true
  }

  // 查询漫画压缩包导入任务详情，前端可用该接口轮询预解析草稿和后台导入执行状态。
  async getArchiveDetail(input: ComicArchiveTaskIdDto) {
    const record = await this.readTaskRecord(input.taskId)
    const latestRecord = await this.refreshExpiredDraftTask(record)
    return this.toTaskView(latestRecord)
  }

  // 消费待处理的漫画压缩包导入任务，任务元数据统一走数据库持久化，worker 只依赖 taskId 定位本地临时目录。
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

  // 执行已确认任务，逐章导入并持续回写任务进度。
  private async processTask(record: ComicArchiveTaskRecord) {
    let successCount = 0
    let failureCount = 0
    let lastError: string | null = null

    try {
      for (const chapterId of record.confirmedChapterIds) {
        const matchedItem = record.matchedItems.find(
          (item) => item.chapterId === chapterId,
        )
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
      this.logger.error(
        `comic_archive_process_failed taskId=${record.taskId} error=${message}`,
      )
    }
  }

  // 导入单个章节图片，并用上传后的图片路径整体覆盖章节内容。
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

    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set({ content: JSON.stringify(contents) })
          .where(
            and(
              eq(this.workChapter.id, matchedItem.chapterId),
              eq(this.workChapter.workId, record.workId),
              isNull(this.workChapter.deletedAt),
            ),
          ),
      { notFound: '章节不存在' },
    )

    return contents
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

  // 校验预解析会话仍然开放，并且与当前上传上下文一致。
  private async assertOpenPreviewSessionMatches(input: PreviewComicArchiveDto) {
    const session = await this.readPreviewSessionRecord(input.taskId)
    const requestedChapterId = input.chapterId ?? null

    if (
      session.status !== ComicArchivePreviewSessionStatusEnum.OPEN ||
      session.workId !== input.workId ||
      session.chapterId !== requestedChapterId ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '预解析会话已失效，请重新选择压缩包',
      )
    }

    return session
  }

  // 执行 assertDraftTaskAvailable。
  private async assertDraftTaskAvailable(record: ComicArchiveTaskRecord) {
    const latestRecord = await this.refreshExpiredDraftTask(record)
    if (latestRecord.status === ComicArchiveTaskStatusEnum.EXPIRED) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '预解析任务已过期，请重新上传压缩包',
      )
    }

    if (latestRecord.status !== ComicArchiveTaskStatusEnum.DRAFT) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '当前任务状态不允许确认导入',
      )
    }

    return latestRecord
  }

  // 执行 refreshExpiredDraftTask。
  private async refreshExpiredDraftTask(record: ComicArchiveTaskRecord) {
    if (
      record.status !== ComicArchiveTaskStatusEnum.DRAFT ||
      record.expiresAt.getTime() > Date.now()
    ) {
      return record
    }

    record.status = ComicArchiveTaskStatusEnum.EXPIRED
    record.updatedAt = new Date()
    await this.updateTaskRecord(record)
    return record
  }

  // 执行 toTaskView。
  private toTaskView(
    record: ComicArchiveTaskRecord,
  ): ComicArchiveTaskResponseDto {
    return {
      taskId: record.taskId,
      workId: record.workId,
      mode: record.mode,
      status: record.status,
      requireConfirm: record.requireConfirm,
      backgroundOwned: this.isBackgroundOwned(record),
      summary: record.summary,
      matchedItems: record.matchedItems.map(
        ({ imagePaths: _imagePaths, ...item }) => item,
      ),
      ignoredItems: record.ignoredItems,
      resultItems: record.resultItems,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      expiresAt: record.expiresAt,
      lastError: record.lastError,
    }
  }

  // 判断任务是否已经越过用户确认边界，允许在弹窗外展示后台任务摘要。
  private isBackgroundOwned(record: ComicArchiveTaskRecord) {
    return record.confirmedChapterIds.length > 0
  }

  // 判断任务是否仍属于可硬删除的预确认残留。
  private canDiscardTaskRecord(record: ComicArchiveTaskRecord) {
    if (this.isBackgroundOwned(record)) {
      return false
    }

    return (
      record.status === ComicArchiveTaskStatusEnum.DRAFT ||
      record.status === ComicArchiveTaskStatusEnum.EXPIRED ||
      record.status === ComicArchiveTaskStatusEnum.CANCELLED
    )
  }

  // 执行 cleanupTasks。
  private async cleanupTasks() {
    const now = new Date()
    const retentionCutoff = new Date(
      now.getTime() - ARCHIVE_TASK_CLEANUP_RETENTION_MS,
    )

    await this.cleanupExpiredPreviewResidues(now)

    const rows = await this.db
      .select({
        taskId: this.workComicArchiveImportTask.taskId,
      })
      .from(this.workComicArchiveImportTask)
      .where(
        and(
          inArray(this.workComicArchiveImportTask.status, [
            ...TERMINAL_TASK_STATUSES,
          ]),
          lt(this.workComicArchiveImportTask.updatedAt, retentionCutoff),
        ),
      )

    for (const row of rows) {
      await fs
        .rm(this.getTaskDir(row.taskId), {
          recursive: true,
          force: true,
        })
        .catch(() => undefined)
    }
  }

  // 清理过期预确认会话和草稿，作为弹窗关闭强取消之外的崩溃恢复兜底。
  private async cleanupExpiredPreviewResidues(now: Date) {
    const sessionRows = await this.db
      .select({
        taskId: this.workComicArchiveImportPreviewSession.taskId,
      })
      .from(this.workComicArchiveImportPreviewSession)
      .where(lte(this.workComicArchiveImportPreviewSession.expiresAt, now))

    const draftRows = await this.db
      .select({
        taskId: this.workComicArchiveImportTask.taskId,
      })
      .from(this.workComicArchiveImportTask)
      .where(
        and(
          inArray(this.workComicArchiveImportTask.status, [
            ComicArchiveTaskStatusEnum.DRAFT,
            ComicArchiveTaskStatusEnum.EXPIRED,
            ComicArchiveTaskStatusEnum.CANCELLED,
          ]),
          lte(this.workComicArchiveImportTask.expiresAt, now),
        ),
      )

    const taskIds = new Set([
      ...sessionRows.map((row) => row.taskId),
      ...draftRows.map((row) => row.taskId),
    ])

    for (const taskId of taskIds) {
      const record = await this.tryReadTaskRecord(taskId)
      if (record && !this.canDiscardTaskRecord(record)) {
        continue
      }
      try {
        await this.removeTaskDir(taskId)
        await this.deletePreConfirmResidue(taskId)
      } catch (error) {
        this.logger.warn(
          `comic_archive_preview_cleanup_failed taskId=${taskId} error=${this.stringifyError(error)}`,
        )
      }
    }
  }

  // 获取 task Root Dir。
  private getTaskRootDir() {
    return join(this.uploadConfig.tmpDir, 'comic-archive-import')
  }

  // 获取 task Dir。
  private getTaskDir(taskId: string) {
    return join(this.getTaskRootDir(), taskId)
  }

  // 获取 task Extract Dir。
  private getTaskExtractDir(taskId: string) {
    return join(this.getTaskDir(taskId), 'extract')
  }

  // 执行 claimNextPendingTask。
  private async claimNextPendingTask() {
    const [pendingTask] = await this.db
      .select({
        taskId: this.workComicArchiveImportTask.taskId,
      })
      .from(this.workComicArchiveImportTask)
      .where(
        eq(
          this.workComicArchiveImportTask.status,
          ComicArchiveTaskStatusEnum.PENDING,
        ),
      )
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
        .where(
          and(
            eq(this.workComicArchiveImportTask.taskId, pendingTask.taskId),
            eq(
              this.workComicArchiveImportTask.status,
              ComicArchiveTaskStatusEnum.PENDING,
            ),
          ),
        )
        .returning(),
    )

    if (rows.length === 0) {
      return null
    }

    return this.toTaskRecord(rows[0])
  }

  // 创建 preview session Record。
  private async createPreviewSessionRecord(
    record: ComicArchivePreviewSessionRecord,
  ) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.workComicArchiveImportPreviewSession).values({
        taskId: record.taskId,
        workId: record.workId,
        chapterId: record.chapterId,
        status: record.status,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    )
  }

  // 在同一事务中锁定开放会话并创建草稿，避免 discard 已成功后又产生 late DRAFT。
  private async createTaskRecordIfSessionOpen(record: ComicArchiveTaskRecord) {
    const now = new Date()
    const inserted = await this.drizzle.withTransaction(async (tx) => {
      const sessions = await tx
        .update(this.workComicArchiveImportPreviewSession)
        .set({ updatedAt: now })
        .where(
          and(
            eq(this.workComicArchiveImportPreviewSession.taskId, record.taskId),
            eq(
              this.workComicArchiveImportPreviewSession.status,
              ComicArchivePreviewSessionStatusEnum.OPEN,
            ),
          ),
        )
        .returning({
          taskId: this.workComicArchiveImportPreviewSession.taskId,
        })

      if (sessions.length === 0) {
        return false
      }

      await tx.insert(this.workComicArchiveImportTask).values({
        taskId: record.taskId,
        ...this.buildTaskPersistValues(record),
        createdAt: record.createdAt,
      })
      return true
    })

    if (!inserted) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '预解析会话已取消，请重新上传压缩包',
      )
    }
  }

  // 为 discard 原子认领开放会话；已处于 DISCARDING 的会话允许重试清理。
  private async claimPreviewSessionForDiscard(taskId: string) {
    const now = new Date()
    const rows = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workComicArchiveImportPreviewSession)
        .set({
          status: ComicArchivePreviewSessionStatusEnum.DISCARDING,
          updatedAt: now,
        })
        .where(
          and(
            eq(this.workComicArchiveImportPreviewSession.taskId, taskId),
            eq(
              this.workComicArchiveImportPreviewSession.status,
              ComicArchivePreviewSessionStatusEnum.OPEN,
            ),
          ),
        )
        .returning(),
    )

    if (rows.length > 0) {
      return this.toPreviewSessionRecord(rows[0])
    }

    const session = await this.tryReadPreviewSessionRecord(taskId)
    return session?.status === ComicArchivePreviewSessionStatusEnum.DISCARDING
      ? session
      : null
  }

  // 确认导入时原子删除开放会话并把草稿推进到 PENDING。
  private async claimPreviewSessionForConfirm(record: ComicArchiveTaskRecord) {
    return this.drizzle.withTransaction(async (tx) => {
      const sessions = await tx
        .delete(this.workComicArchiveImportPreviewSession)
        .where(
          and(
            eq(this.workComicArchiveImportPreviewSession.taskId, record.taskId),
            eq(
              this.workComicArchiveImportPreviewSession.status,
              ComicArchivePreviewSessionStatusEnum.OPEN,
            ),
          ),
        )
        .returning({
          taskId: this.workComicArchiveImportPreviewSession.taskId,
        })

      if (sessions.length === 0) {
        return false
      }

      const tasks = await tx
        .update(this.workComicArchiveImportTask)
        .set(this.buildTaskPersistValues(record))
        .where(
          and(
            eq(this.workComicArchiveImportTask.taskId, record.taskId),
            eq(
              this.workComicArchiveImportTask.status,
              ComicArchiveTaskStatusEnum.DRAFT,
            ),
          ),
        )
        .returning({
          taskId: this.workComicArchiveImportTask.taskId,
        })

      if (tasks.length === 0) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '当前任务状态不允许确认导入',
        )
      }

      return true
    })
  }

  // 删除预确认草稿和会话标记。调用前必须已经成功删除本地临时目录。
  private async deletePreConfirmResidue(taskId: string) {
    await this.drizzle.withTransaction(async (tx) => {
      await tx
        .delete(this.workComicArchiveImportTask)
        .where(eq(this.workComicArchiveImportTask.taskId, taskId))
      await tx
        .delete(this.workComicArchiveImportPreviewSession)
        .where(eq(this.workComicArchiveImportPreviewSession.taskId, taskId))
    })
  }

  // 删除任务临时目录。
  private async removeTaskDir(taskId: string) {
    await fs.rm(this.getTaskDir(taskId), {
      recursive: true,
      force: true,
    })
  }

  // 执行 readTaskRecord。
  private async readTaskRecord(taskId: string) {
    const record = await this.tryReadTaskRecord(taskId)
    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '导入任务不存在',
      )
    }
    return record
  }

  // 读取 preview session Record。
  private async readPreviewSessionRecord(taskId: string) {
    const record = await this.tryReadPreviewSessionRecord(taskId)
    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '预解析会话不存在',
      )
    }
    return record
  }

  // 执行 tryReadTaskRecord。
  private async tryReadTaskRecord(taskId: string) {
    const [row] = await this.db
      .select()
      .from(this.workComicArchiveImportTask)
      .where(eq(this.workComicArchiveImportTask.taskId, taskId))
      .limit(1)

    return row ? this.toTaskRecord(row) : null
  }

  // 尝试读取 preview session Record。
  private async tryReadPreviewSessionRecord(taskId: string) {
    const [row] = await this.db
      .select()
      .from(this.workComicArchiveImportPreviewSession)
      .where(eq(this.workComicArchiveImportPreviewSession.taskId, taskId))
      .limit(1)

    return row ? this.toPreviewSessionRecord(row) : null
  }

  // 更新 task Record。
  private async updateTaskRecord(record: ComicArchiveTaskRecord) {
    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.workComicArchiveImportTask)
        .set(this.buildTaskPersistValues(record))
        .where(eq(this.workComicArchiveImportTask.taskId, record.taskId)),
    )
    this.drizzle.assertAffectedRows(result, '导入任务不存在')
  }

  // 执行 safeUpdateTaskRecord。
  private async safeUpdateTaskRecord(record: ComicArchiveTaskRecord) {
    try {
      await this.updateTaskRecord(record)
    } catch (error) {
      const message = this.stringifyError(error)
      this.logger.error(
        `comic_archive_update_failed taskId=${record.taskId} error=${message}`,
      )
    }
  }

  // 构建 task Persist Values。
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

  // 把数据库行收敛成稳定的领域任务记录，JSONB 字段会做最小归一化，避免脏数据直接透出到接口层。
  private toTaskRecord(
    row: WorkComicArchiveImportTaskSelect,
  ): ComicArchiveTaskRecord {
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
      confirmedChapterIds: this.normalizeConfirmedChapterIds(
        row.confirmedChapterIds,
      ),
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      expiresAt: row.expiresAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  // 把数据库行收敛成稳定的预解析会话记录。
  private toPreviewSessionRecord(
    row: WorkComicArchiveImportPreviewSessionSelect,
  ): ComicArchivePreviewSessionRecord {
    return {
      taskId: row.taskId,
      workId: row.workId,
      chapterId: row.chapterId,
      status: this.normalizePreviewSessionStatus(row.status),
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  // 归一化 summary。
  private normalizeSummary<T>(value: T): ComicArchiveSummaryDto {
    const record = this.asObject(value)
    return {
      matchedChapterCount: this.asNumber(record?.matchedChapterCount),
      ignoredItemCount: this.asNumber(record?.ignoredItemCount),
      imageCount: this.asNumber(record?.imageCount),
    }
  }

  // 归一化 ignored Items。
  private normalizeIgnoredItems<T>(value: T): ComicArchiveIgnoredItemDto[] {
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

  // 归一化 matched Items。
  private normalizeMatchedItems<T>(value: T): ComicArchiveMatchedItemRecord[] {
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

  // 归一化 result Items。
  private normalizeResultItems<T>(value: T): ComicArchiveResultItemDto[] {
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

  // 归一化 confirmed Chapter Ids。
  private normalizeConfirmedChapterIds<T>(value: T) {
    if (!Array.isArray(value)) {
      return []
    }

    return value
      .map((item) => this.asNumber(item))
      .filter((chapterId) => chapterId > 0)
  }

  // 归一化 task Status。
  private normalizeTaskStatus<T>(value: T): ComicArchiveTaskStatusEnum {
    if (
      value === ComicArchiveTaskStatusEnum.DRAFT ||
      value === ComicArchiveTaskStatusEnum.PENDING ||
      value === ComicArchiveTaskStatusEnum.PROCESSING ||
      value === ComicArchiveTaskStatusEnum.SUCCESS ||
      value === ComicArchiveTaskStatusEnum.PARTIAL_FAILED ||
      value === ComicArchiveTaskStatusEnum.FAILED ||
      value === ComicArchiveTaskStatusEnum.EXPIRED ||
      value === ComicArchiveTaskStatusEnum.CANCELLED
    ) {
      return value as ComicArchiveTaskStatusEnum
    }
    throw new InternalServerErrorException('漫画压缩包导入任务状态非法')
  }

  // 归一化 preview Session Status。
  private normalizePreviewSessionStatus<T>(
    value: T,
  ): ComicArchivePreviewSessionStatusEnum {
    if (
      value === ComicArchivePreviewSessionStatusEnum.OPEN ||
      value === ComicArchivePreviewSessionStatusEnum.DISCARDING
    ) {
      return value as ComicArchivePreviewSessionStatusEnum
    }
    throw new InternalServerErrorException('漫画压缩包预解析会话状态非法')
  }

  // 归一化 preview Mode。
  private normalizePreviewMode<T>(value: T): ComicArchivePreviewModeEnum {
    if (
      value === ComicArchivePreviewModeEnum.SINGLE_CHAPTER ||
      value === ComicArchivePreviewModeEnum.MULTI_CHAPTER
    ) {
      return value as ComicArchivePreviewModeEnum
    }
    throw new InternalServerErrorException('漫画压缩包导入任务模式非法')
  }

  // 归一化 import Item Status。
  private normalizeImportItemStatus<T>(
    value: T,
  ): ComicArchiveImportItemStatusEnum {
    if (
      value === ComicArchiveImportItemStatusEnum.PENDING ||
      value === ComicArchiveImportItemStatusEnum.SUCCESS ||
      value === ComicArchiveImportItemStatusEnum.FAILED
    ) {
      return value as ComicArchiveImportItemStatusEnum
    }
    throw new InternalServerErrorException('漫画压缩包导入结果状态非法')
  }

  // 归一化 ignore Reason。
  private normalizeIgnoreReason<T>(value: T): ComicArchiveIgnoreReasonEnum {
    return Object.values(ComicArchiveIgnoreReasonEnum).includes(
      value as ComicArchiveIgnoreReasonEnum,
    )
      ? (value as ComicArchiveIgnoreReasonEnum)
      : ComicArchiveIgnoreReasonEnum.INVALID_IMAGE_FILE
  }

  // 执行 asObject。
  private asObject<T>(value: T) {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : null
  }

  // 执行 asString。
  private asString<T>(value: T) {
    return typeof value === 'string' ? value : ''
  }

  // 执行 asNumber。
  private asNumber<T>(value: T) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  // 执行 asBoolean。
  private asBoolean<T>(value: T) {
    return typeof value === 'boolean' ? value : false
  }

  // 执行 asStringArray。
  private asStringArray<T>(value: T) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
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
