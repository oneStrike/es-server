import type {
  ThirdPartyComicDetailDto,
  ThirdPartyComicImageDto,
  ThirdPartyComicImportChapterItemDto,
  ThirdPartyComicImportChapterResultDto,
  ThirdPartyComicImportRequestDto,
  ThirdPartyComicImportResultDto,
  ThirdPartyComicImportWorkDraftDto,
} from '@libs/content/work/content/dto/content.dto'
import type {
  BackgroundTaskObject,
  BackgroundTaskProgressReporter,
} from '@libs/platform/modules/background-task/types'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type { ComicThirdPartyProvider } from '../providers/comic-third-party-provider.type'
import type {
  RemoteImageImportSuccessPayload,
  ThirdPartyComicChapterImportPlan,
  ThirdPartyComicImageImportProgressDetail,
  ThirdPartyComicImportResidue,
  ThirdPartyComicImportTaskContext,
  ThirdPartyComicUpdatedChapterSnapshot,
} from '../third-party-comic-import.type'
import { DrizzleService } from '@db/core'
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ComicContentService } from '@libs/content/work/content/comic-content.service'
import {
  ThirdPartyComicImportChapterActionEnum,
  ThirdPartyComicImportChapterStatusEnum,
  ThirdPartyComicImportCoverModeEnum,
  ThirdPartyComicImportCoverStatusEnum,
  ThirdPartyComicImportModeEnum,
  ThirdPartyComicImportPreviewRequestDto,
  ThirdPartyComicImportStatusEnum,
  ThirdPartyComicImportWorkStatusEnum,
} from '@libs/content/work/content/dto/content.dto'
import { WorkService } from '@libs/content/work/core/work.service'
import {
  BusinessErrorCode,
  WorkTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BackgroundTaskOperatorTypeEnum } from '@libs/platform/modules/background-task/background-task.constant'
import { BackgroundTaskService } from '@libs/platform/modules/background-task/background-task.service'
import { formatDateOnlyInAppTimeZone } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { ComicThirdPartyRegistry } from '../providers/comic-third-party.registry'
import { THIRD_PARTY_COMIC_IMPORT_TASK_TYPE } from '../third-party-comic-import.constant'
import { RemoteImageImportService } from './remote-image-import.service'

@Injectable()
export class ThirdPartyComicImportService {
  // 注入导入所需的 provider、作品、章节、内容和远程图片服务。
  constructor(
    private readonly registry: ComicThirdPartyRegistry,
    private readonly workService: WorkService,
    private readonly workChapterService: WorkChapterService,
    private readonly comicContentService: ComicContentService,
    private readonly remoteImageImportService: RemoteImageImportService,
    private readonly backgroundTaskService: BackgroundTaskService,
    private readonly drizzle: DrizzleService,
  ) {}

  // 读取 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取 workChapter。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 预览第三方漫画导入方案，只读取 provider 数据不写入本地。
  async previewImport(dto: ThirdPartyComicImportPreviewRequestDto) {
    const provider = this.registry.resolve(dto.platform)
    const detail = await provider.getDetail(dto)
    const chapters = await provider.getChapters(dto)

    return {
      platform: dto.platform,
      comicId: dto.comicId,
      sourceSnapshot: {
        providerComicId: detail.id,
        pathWord: detail.pathWord,
        uuid: detail.uuid,
        fetchedAt: new Date().toISOString(),
      },
      detail,
      groups: detail.groups,
      chapters,
      workDraft: {
        name: detail.name,
        alias: detail.alias,
        description: detail.brief || detail.name,
        originalSource: `CopyManga:${detail.pathWord}`,
        remark: `三方导入：CopyManga ${detail.pathWord}`,
        suggestedRegion: detail.region,
        suggestedSerialStatus: this.resolveSuggestedSerialStatus(detail.status),
      },
      coverOptions: {
        provider: detail.cover
          ? {
              providerImageId: this.buildCoverProviderImageId(detail),
              url: detail.cover,
            }
          : undefined,
        localRequired: !detail.cover,
      },
      relationCandidates: {
        authors: detail.authors.map((providerName) => ({
          providerName,
          localCandidates: [],
        })),
        categories: detail.taxonomies.map((providerName) => ({
          providerName,
          localCandidates: [],
        })),
        tags: detail.taxonomies.map((providerName) => ({
          providerName,
          localCandidates: [],
        })),
      },
      missingLocalFields: [
        'authorIds',
        'categoryIds',
        'tagIds',
        'language',
        'region',
        'serialStatus',
        'viewRule',
      ],
    }
  }

  // 确认第三方漫画导入，只创建后台任务，不在 HTTP 请求内执行重型导入。
  async confirmImport(dto: ThirdPartyComicImportRequestDto, userId: number) {
    return this.backgroundTaskService.createTask({
      taskType: THIRD_PARTY_COMIC_IMPORT_TASK_TYPE,
      payload: dto as unknown as BackgroundTaskObject,
      operator: {
        type: BackgroundTaskOperatorTypeEnum.ADMIN,
        userId,
      },
    })
  }

  // 执行第三方漫画导入后台任务，任一失败都会抛出并交由任务框架回滚。
  async executeImportTask(
    dto: ThirdPartyComicImportRequestDto,
    context: ThirdPartyComicImportTaskContext,
  ): Promise<ThirdPartyComicImportResultDto & BackgroundTaskObject> {
    const provider = this.registry.resolve(dto.platform)
    const detail = await provider.getDetail({
      comicId: dto.comicId,
      platform: dto.platform,
    })
    await context.assertNotCancelled()
    const preparedWork = await this.prepareWork(dto, detail, context)
    const workResult = preparedWork.work

    if (!workResult.id) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        workResult.message ?? '作品导入准备失败',
      )
    }

    const chapterResults: ThirdPartyComicImportChapterResultDto[] = []
    const chapterPlans = await this.buildChapterImportPlans(
      dto,
      provider,
      context,
    )
    const imageProgressReporter = context.createProgressReporter({
      startPercent: 10,
      endPercent: 95,
      total: this.countPlannedImages(chapterPlans),
      stage: 'image-import',
      unit: 'image',
    })
    for (const chapterPlan of chapterPlans) {
      await context.assertNotCancelled()
      chapterResults.push(
        await this.importChapter(
          chapterPlan,
          workResult.id,
          context,
          imageProgressReporter,
        ),
      )
    }

    await context.updateProgress({
      percent: 100,
      message: '第三方漫画导入完成',
    })

    return {
      mode: dto.mode,
      status: ThirdPartyComicImportStatusEnum.SUCCESS,
      work: workResult,
      cover: preparedWork.cover,
      chapters: chapterResults,
    } as ThirdPartyComicImportResultDto & BackgroundTaskObject
  }

  // 回滚失败或取消的第三方漫画导入任务。
  async rollbackImportTask(
    context: ThirdPartyComicImportTaskContext,
    _error?: unknown,
  ) {
    const residue = await context.getResidue()
    const createdChapterIds = [...(residue.createdChapterIds ?? [])].reverse()
    if (createdChapterIds.length > 0) {
      await this.workChapterService.deleteChapters(createdChapterIds)
    }

    for (const snapshot of [...(residue.updatedChapters ?? [])].reverse()) {
      await this.restoreChapterSnapshot(snapshot)
    }

    const createdWorkIds = [...(residue.createdWorkIds ?? [])].reverse()
    for (const workId of createdWorkIds) {
      await this.workService.deleteWork(workId)
    }

    const cleanupFailures: string[] = []
    for (const uploadedFile of [...(residue.uploadedFiles ?? [])].reverse()) {
      try {
        await this.remoteImageImportService.deleteImportedFile(uploadedFile)
      } catch (error) {
        cleanupFailures.push(
          `${uploadedFile.provider}:${uploadedFile.filePath} (${this.stringifyUnknownError(
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

  // 准备本地作品和封面，失败时抛出并交由后台任务回滚。
  private async prepareWork(
    dto: ThirdPartyComicImportRequestDto,
    detail: ThirdPartyComicDetailDto,
    context: ThirdPartyComicImportTaskContext,
  ) {
    if (dto.mode === ThirdPartyComicImportModeEnum.ATTACH_TO_EXISTING) {
      if (!dto.targetWorkId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '挂载已有作品必须选择目标作品',
        )
      }

      await this.workService.getWorkDetail(dto.targetWorkId, {
        bypassVisibilityCheck: true,
      })
      return {
        cover: {
          status: ThirdPartyComicImportCoverStatusEnum.SKIPPED,
          message: '挂载已有作品不修改作品封面',
        },
        work: {
          id: dto.targetWorkId,
          status: ThirdPartyComicImportWorkStatusEnum.ATTACHED,
          message: '已挂载到本地作品',
        },
      }
    }

    if (!dto.workDraft) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '新建作品必须提交作品草稿',
      )
    }

    let coverFailureMessage = '新建作品封面处理失败'
    let coverFailureCause: Error | string | undefined
    let coverPath: string | undefined
    try {
      const coverImport = await this.resolveWorkCover(dto, detail)
      coverPath = coverImport?.filePath
      if (coverImport?.deleteTarget) {
        await this.recordUploadedFile(context, coverImport.deleteTarget)
      }
    } catch (error) {
      coverPath = undefined
      if (error instanceof Error) {
        coverFailureMessage = error.message
        coverFailureCause = error
      } else {
        coverFailureCause = this.stringifyUnknownError(error)
      }
    }

    if (!coverPath) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        coverFailureMessage,
        { cause: coverFailureCause },
      )
    }

    const workId = await this.workService.createWorkReturningId(
      this.toCreateWorkDto(dto.workDraft, coverPath),
    )
    await this.recordCreatedWork(context, workId)

    return {
      cover: {
        status:
          dto.cover?.mode === ThirdPartyComicImportCoverModeEnum.LOCAL
            ? ThirdPartyComicImportCoverStatusEnum.LOCAL
            : ThirdPartyComicImportCoverStatusEnum.UPLOADED,
        filePath: coverPath,
        message: '作品封面处理成功',
      },
      work: {
        id: workId,
        status: ThirdPartyComicImportWorkStatusEnum.CREATED,
        message: '作品创建成功',
      },
    }
  }

  // 导入单个章节，章节失败会中断任务并交由后台任务回滚。
  private async importChapter(
    chapterPlan: ThirdPartyComicChapterImportPlan,
    workId: number,
    context: ThirdPartyComicImportTaskContext,
    imageProgressReporter: BackgroundTaskProgressReporter,
  ) {
    const { chapter } = chapterPlan
    const localChapterId = await this.prepareChapter(chapter, workId, context)
    const cover = await this.importChapterCover(chapter)

    if (!chapter.importImages) {
      return {
        providerChapterId: chapter.providerChapterId,
        localChapterId,
        action: chapter.action,
        status: ThirdPartyComicImportChapterStatusEnum.METADATA_ONLY,
        cover,
        imageTotal: 0,
        imageSucceeded: 0,
        message: '章节元数据已处理，未导入图片',
      }
    }

    await context.assertNotCancelled()
    const filePaths = await this.remoteImageImportService.importImages(
      chapterPlan.images,
      ['work', 'comic', String(workId), 'chapter', String(localChapterId)],
      async (importedFile) => {
        await this.recordUploadedFile(context, importedFile.deleteTarget)
        await imageProgressReporter.advance({
          message: `已导入第 ${chapterPlan.chapterIndex}/${chapterPlan.chapterTotal} 个章节的第 ${importedFile.imageIndex}/${importedFile.imageTotal} 张图片`,
          detail: this.toImageProgressDetail(chapterPlan, importedFile),
        })
      },
    )
    await context.assertNotCancelled()
    await this.comicContentService.replaceChapterContents(
      localChapterId,
      filePaths,
    )

    return {
      providerChapterId: chapter.providerChapterId,
      localChapterId,
      action: chapter.action,
      status: ThirdPartyComicImportChapterStatusEnum.CONTENT_IMPORTED,
      cover,
      imageTotal: chapterPlan.imageTotal,
      imageSucceeded: filePaths.length,
      message: '章节图片导入成功',
    }
  }

  // 先校验并拉取章节图片计划，避免内容读取失败后才发现已写入本地章节。
  private async buildChapterImportPlans(
    dto: ThirdPartyComicImportRequestDto,
    provider: ComicThirdPartyProvider,
    context: ThirdPartyComicImportTaskContext,
  ): Promise<ThirdPartyComicChapterImportPlan[]> {
    const chapterTotal = dto.chapters.length
    const plans: ThirdPartyComicChapterImportPlan[] = []
    for (const [index, chapter] of dto.chapters.entries()) {
      await context.assertNotCancelled()
      if (!chapter.importImages) {
        plans.push({
          chapter,
          chapterIndex: index + 1,
          chapterTotal,
          images: [],
          imageTotal: 0,
        })
        continue
      }

      this.assertChapterContentOverwriteAllowed(chapter)
      await context.assertNotCancelled()
      const content = await provider.getChapterContent({
        chapterId: chapter.providerChapterId,
        chapterApiVersion: chapter.chapterApiVersion,
        comicId: dto.comicId,
        platform: dto.platform,
      })
      const images = this.sortImages(content.images)
      plans.push({
        chapter,
        chapterIndex: index + 1,
        chapterTotal,
        images,
        imageTotal: images.length,
      })
    }
    return plans
  }

  // 更新章节内容前必须显式确认覆盖，且校验早于远端内容读取。
  private assertChapterContentOverwriteAllowed(
    chapter: ThirdPartyComicImportChapterItemDto,
  ) {
    if (
      chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE &&
      !chapter.overwriteContent
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '更新章节内容必须确认覆盖',
      )
    }
  }

  // 统计计划中的全局图片总量，作为后台任务整任务进度分母。
  private countPlannedImages(plans: ThirdPartyComicChapterImportPlan[]) {
    return plans.reduce((total, plan) => total + plan.imageTotal, 0)
  }

  // 将单张图片导入结果转换为可展示且不含敏感 query 的进度详情。
  private toImageProgressDetail(
    chapterPlan: ThirdPartyComicChapterImportPlan,
    importedFile: RemoteImageImportSuccessPayload,
  ): ThirdPartyComicImageImportProgressDetail {
    return {
      providerChapterId: chapterPlan.chapter.providerChapterId,
      chapterIndex: chapterPlan.chapterIndex,
      chapterTotal: chapterPlan.chapterTotal,
      providerImageId: importedFile.image.providerImageId,
      imageIndex: importedFile.imageIndex,
      imageTotal: importedFile.imageTotal,
      safeSourceUrl: importedFile.safeSourceUrl,
      filePath: importedFile.filePath,
      fileSize: importedFile.fileSize,
      mimeType: importedFile.mimeType,
    }
  }

  // 创建或更新本地章节元数据，并返回本地章节 ID。
  private async prepareChapter(
    chapter: ThirdPartyComicImportChapterItemDto,
    workId: number,
    context: ThirdPartyComicImportTaskContext,
  ) {
    if (chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE) {
      if (!chapter.targetChapterId) {
        throw new Error('更新章节必须选择目标章节')
      }
      await this.appendResidueList(
        context,
        'updatedChapters',
        await this.readChapterSnapshot(chapter.targetChapterId),
      )
      await this.workChapterService.updateChapter({
        id: chapter.targetChapterId,
        ...this.toChapterUpdate(chapter),
      })
      return chapter.targetChapterId
    }

    const createdChapterId =
      await this.workChapterService.createChapterReturningId({
        ...this.toChapterUpdate(chapter),
        workId,
        workType: WorkTypeEnum.COMIC,
      })
    await this.recordCreatedChapter(context, createdChapterId)
    return createdChapterId
  }

  // 解析章节封面导入结果，CopyManga 当前不提供章节封面远程下载。
  private async importChapterCover(
    chapter: ThirdPartyComicImportChapterItemDto,
  ) {
    if (
      !chapter.cover ||
      chapter.cover.mode === ThirdPartyComicImportCoverModeEnum.SKIP
    ) {
      return {
        status: ThirdPartyComicImportCoverStatusEnum.SKIPPED,
        message: '章节封面未导入',
      }
    }
    if (chapter.cover.mode === ThirdPartyComicImportCoverModeEnum.LOCAL) {
      return {
        status: ThirdPartyComicImportCoverStatusEnum.LOCAL,
        filePath: chapter.cover.localPath,
        message: '使用本地章节封面',
      }
    }

    return {
      status: ThirdPartyComicImportCoverStatusEnum.FAILED,
      errorCode: 'CHAPTER_COVER_UNAVAILABLE',
      message: 'CopyManga 章节列表未提供章节封面',
    }
  }

  // 根据用户选择解析作品封面路径，provider 封面会先下载到本地上传并返回删除句柄。
  private async resolveWorkCover(
    dto: ThirdPartyComicImportRequestDto,
    detail: ThirdPartyComicDetailDto,
  ) {
    if (dto.cover?.mode === ThirdPartyComicImportCoverModeEnum.LOCAL) {
      return {
        filePath: dto.cover.localPath,
      }
    }

    if (
      dto.cover?.mode !== ThirdPartyComicImportCoverModeEnum.PROVIDER ||
      dto.cover.providerImageId !== this.buildCoverProviderImageId(detail) ||
      !detail.cover
    ) {
      return undefined
    }

    const importedCover = await this.remoteImageImportService.importImage(
      detail.cover,
      ['comic', 'image', formatDateOnlyInAppTimeZone(new Date())],
    )
    return {
      filePath: importedCover.upload.filePath,
      deleteTarget: importedCover.deleteTarget,
    }
  }

  // 将导入草稿转换为本地作品创建 DTO。
  private toCreateWorkDto(
    workDraft: ThirdPartyComicImportWorkDraftDto,
    cover: string,
  ) {
    return {
      ...workDraft,
      canComment: workDraft.canComment ?? true,
      chapterPrice: workDraft.chapterPrice ?? 0,
      cover,
      isHot: workDraft.isHot ?? false,
      isNew: workDraft.isNew ?? false,
      isPublished: workDraft.isPublished ?? false,
      isRecommended: workDraft.isRecommended ?? false,
      recommendWeight: workDraft.recommendWeight ?? 0,
      type: WorkTypeEnum.COMIC,
    }
  }

  // 将导入章节条目转换为本地章节创建或更新字段。
  private toChapterUpdate(chapter: ThirdPartyComicImportChapterItemDto) {
    return {
      canComment: chapter.canComment ?? true,
      canDownload: chapter.canDownload ?? true,
      cover:
        chapter.cover?.mode === ThirdPartyComicImportCoverModeEnum.LOCAL
          ? chapter.cover.localPath
          : undefined,
      isPreview: chapter.isPreview ?? false,
      isPublished: chapter.isPublished ?? false,
      price: chapter.price ?? 0,
      sortOrder: chapter.sortOrder,
      title: chapter.title,
      subtitle: chapter.subtitle,
      viewRule: chapter.viewRule ?? WorkViewPermissionEnum.INHERIT,
    }
  }

  // 读取章节回滚快照。
  private async readChapterSnapshot(
    chapterId: number,
  ): Promise<ThirdPartyComicUpdatedChapterSnapshot> {
    const row = await this.db.query.workChapter.findFirst({
      where: { id: chapterId, deletedAt: { isNull: true } },
      columns: {
        id: true,
        title: true,
        subtitle: true,
        cover: true,
        description: true,
        sortOrder: true,
        isPublished: true,
        isPreview: true,
        publishAt: true,
        viewRule: true,
        requiredViewLevelId: true,
        price: true,
        canDownload: true,
        canComment: true,
        content: true,
      },
    })
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '章节不存在',
      )
    }
    return row
  }

  // 还原章节元数据和内容快照。
  private async restoreChapterSnapshot(
    snapshot: ThirdPartyComicUpdatedChapterSnapshot,
  ) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.workChapter)
          .set({
            title: snapshot.title,
            subtitle: snapshot.subtitle,
            cover: snapshot.cover,
            description: snapshot.description,
            sortOrder: snapshot.sortOrder,
            isPublished: snapshot.isPublished,
            isPreview: snapshot.isPreview,
            publishAt: snapshot.publishAt,
            viewRule: snapshot.viewRule,
            requiredViewLevelId: snapshot.requiredViewLevelId,
            price: snapshot.price,
            canDownload: snapshot.canDownload,
            canComment: snapshot.canComment,
            content: snapshot.content,
          })
          .where(eq(this.workChapter.id, snapshot.id)),
      { notFound: '章节不存在' },
    )
  }

  // 向残留对象中的数组字段追加一项。
  private async appendResidueList<
    TKey extends keyof ThirdPartyComicImportResidue,
  >(
    context: ThirdPartyComicImportTaskContext,
    key: TKey,
    value: NonNullable<ThirdPartyComicImportResidue[TKey]> extends Array<
      infer TItem
    >
      ? TItem
      : never,
  ) {
    const residue = await context.getResidue()
    const currentList = Array.isArray(residue[key])
      ? (residue[key] as unknown[])
      : []
    await context.recordResidue({
      [key]: [...currentList, value],
    } as Partial<ThirdPartyComicImportResidue>)
  }

  // 记录已上传文件的删除句柄；若记录失败则立即同步清理，避免丢失回滚依据。
  private async recordUploadedFile(
    context: ThirdPartyComicImportTaskContext,
    uploadedFile: UploadDeleteTarget,
  ) {
    try {
      await this.appendResidueList(context, 'uploadedFiles', uploadedFile)
    } catch (error) {
      await this.tryCleanupUploadedFile(uploadedFile, error)
      throw error
    }
  }

  // 记录新建作品；若记录失败则立即删除刚创建的作品。
  private async recordCreatedWork(
    context: ThirdPartyComicImportTaskContext,
    workId: number,
  ) {
    try {
      await this.appendResidueList(context, 'createdWorkIds', workId)
    } catch (error) {
      await this.workService.deleteWork(workId)
      throw error
    }
  }

  // 记录新建章节；若记录失败则立即删除刚创建的章节。
  private async recordCreatedChapter(
    context: ThirdPartyComicImportTaskContext,
    chapterId: number,
  ) {
    try {
      await this.appendResidueList(context, 'createdChapterIds', chapterId)
    } catch (error) {
      await this.workChapterService.deleteChapters([chapterId])
      throw error
    }
  }

  // 残留写入失败时同步删除已上传文件；若删除也失败则显式抛出冲突错误。
  private async tryCleanupUploadedFile(
    uploadedFile: UploadDeleteTarget,
    residueError: unknown,
  ) {
    try {
      await this.remoteImageImportService.deleteImportedFile(uploadedFile)
    } catch (cleanupError) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        `上传文件残留记录失败且同步清理失败: ${uploadedFile.provider}:${uploadedFile.filePath}; cleanup=${this.stringifyUnknownError(
          cleanupError,
        )}`,
        {
          cause: residueError instanceof Error ? residueError : undefined,
        },
      )
    }
  }

  // 将非 Error 异常保留为可诊断文本。
  private stringifyUnknownError(error: unknown) {
    if (typeof error === 'string') {
      return error
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'unknown error'
    }
  }

  // 按三方 sortOrder 保持图片导入顺序稳定。
  private sortImages(images: ThirdPartyComicImageDto[]) {
    return [...images].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // 为 provider 封面生成导入请求中的稳定图片 ID。
  private buildCoverProviderImageId(detail: ThirdPartyComicDetailDto) {
    return `cover:${detail.id}`
  }

  // 将三方连载状态文本映射为本地作品连载状态值。
  private resolveSuggestedSerialStatus(status?: string) {
    if (!status) {
      return undefined
    }
    if (status.includes('完') || status.toLowerCase().includes('finish')) {
      return 2
    }
    if (status.includes('停') || status.toLowerCase().includes('pause')) {
      return 3
    }
    return 1
  }
}
