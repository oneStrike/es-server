import type {
  ThirdPartyComicDetailDto,
  ThirdPartyComicImageDto,
  ThirdPartyComicImportChapterItemDto,
  ThirdPartyComicImportChapterResultDto,
  ThirdPartyComicImportRequestDto,
  ThirdPartyComicImportResultDto,
  ThirdPartyComicImportWorkDraftDto,
  ThirdPartyComicSourceSnapshotDto,
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
import { and, eq, isNull, ne, sql } from 'drizzle-orm'
import { ComicThirdPartyRegistry } from '../providers/comic-third-party.registry'
import type { ThirdPartyComicChapterBindingInput } from '../third-party-comic-binding.type'
import { THIRD_PARTY_COMIC_IMPORT_TASK_TYPE } from '../third-party-comic-import.constant'
import { RemoteImageImportService } from './remote-image-import.service'
import { ThirdPartyComicBindingService } from './third-party-comic-binding.service'

const SOURCE_COMIC_CONFLICT_MESSAGE =
  '同源三方作品已有导入任务，请等待任务完成后重试'
const SOURCE_SCOPE_CONFLICT_MESSAGE =
  '同一三方来源分组已有导入任务，请等待任务完成后重试'
const WORK_NAME_CONFLICT_MESSAGE =
  '同名漫画作品已有导入任务，请等待任务完成后重试'
const CHAPTER_TITLE_CONFLICT_MESSAGE =
  '同名漫画章节已有导入任务，请等待任务完成后重试'
const INVALID_RETRY_RESERVATION_SNAPSHOT_MESSAGE =
  '破坏性更新前的三方导入任务缺少或不匹配 reservation snapshot，请重新提交导入任务'
const INVALID_RETRY_RESERVATION_SNAPSHOT_CAUSE_CODE =
  'third_party_import_retry_invalid_reservation_snapshot'

interface ThirdPartyComicImportReservation {
  dedupeKey: string
  dedupeConflictMessage: string
  serialKey: string
  conflictKeys: string[]
  conflictMessageByKey: Record<string, string>
}

interface ThirdPartyComicImportPlannedWork {
  id: number | null
  name: string
}

interface ThirdPartyComicImportReservationContext {
  dto: ThirdPartyComicImportRequestDto
  platform: string
  providerComicId: string
  providerGroupPathWord: string
  plannedWork: ThirdPartyComicImportPlannedWork
  chapterTitles: string[]
}

interface ThirdPartyComicRetryReservationSnapshot {
  dedupeKey: null | string
  serialKey: null | string
  conflictKeys: string[]
}

@Injectable()
export class ThirdPartyComicImportService {
  // 注入导入所需的 provider、作品、章节、内容和远程图片服务。
  constructor(
    private readonly registry: ComicThirdPartyRegistry,
    private readonly workService: WorkService,
    private readonly workChapterService: WorkChapterService,
    private readonly comicContentService: ComicContentService,
    private readonly remoteImageImportService: RemoteImageImportService,
    private readonly bindingService: ThirdPartyComicBindingService,
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

  // 读取 work。
  private get work() {
    return this.drizzle.schema.work
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
        providerPathWord: detail.pathWord,
        providerGroupPathWord: this.resolvePreviewGroup(dto.group),
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
    const reservation = await this.buildImportReservation(dto)
    return this.backgroundTaskService.createTask({
      taskType: THIRD_PARTY_COMIC_IMPORT_TASK_TYPE,
      payload: dto as unknown as BackgroundTaskObject,
      operator: {
        type: BackgroundTaskOperatorTypeEnum.ADMIN,
        userId,
      },
      ...reservation,
    })
  }

  // 校验重试任务持久化的 reservation snapshot 与 payload 当前规则完全一致。
  async validateRetryReservationSnapshot(
    dto: ThirdPartyComicImportRequestDto,
    snapshot: ThirdPartyComicRetryReservationSnapshot,
  ) {
    let expectedReservation: ThirdPartyComicImportReservation
    try {
      expectedReservation = await this.buildImportReservationSnapshot(dto)
    } catch (error) {
      this.throwInvalidRetryReservationSnapshot(error)
    }

    if (
      snapshot.dedupeKey !== expectedReservation.dedupeKey ||
      snapshot.serialKey !== expectedReservation.serialKey ||
      !this.areSameStringSets(
        snapshot.conflictKeys,
        expectedReservation.conflictKeys,
      )
    ) {
      this.throwInvalidRetryReservationSnapshot({
        expectedConflictKeys: expectedReservation.conflictKeys,
        expectedDedupeKey: expectedReservation.dedupeKey,
        expectedSerialKey: expectedReservation.serialKey,
        receivedConflictKeys: snapshot.conflictKeys,
        receivedDedupeKey: snapshot.dedupeKey,
        receivedSerialKey: snapshot.serialKey,
      })
    }
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
    const providerGroupPathWord = this.resolveSourceGroupFromSnapshot(
      dto.sourceSnapshot,
    )
    await this.assertImportStillAllowed(dto, providerGroupPathWord)
    const preparedWork = await this.prepareWork(dto, detail, context)
    const workResult = preparedWork.work

    if (!workResult.id) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        workResult.message ?? '作品导入准备失败',
      )
    }

    const chapterResults: ThirdPartyComicImportChapterResultDto[] = []
    const sourceBinding = await this.bindWorkSource(
      dto,
      detail,
      workResult.id,
      providerGroupPathWord,
      context,
    )
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
          sourceBinding.id,
          sourceBinding.providerGroupPathWord,
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
    const createdChapterBindingIds = [
      ...(residue.createdChapterBindingIds ?? []),
    ].reverse()
    await this.bindingService.softDeleteChapterBindings(
      createdChapterBindingIds,
    )

    const createdChapterIds = [...(residue.createdChapterIds ?? [])].reverse()
    if (createdChapterIds.length > 0) {
      await this.workChapterService.deleteChapters(createdChapterIds)
    }

    for (const snapshot of [...(residue.updatedChapters ?? [])].reverse()) {
      await this.restoreChapterSnapshot(snapshot)
    }

    const createdSourceBindingIds = [
      ...(residue.createdSourceBindingIds ?? []),
    ].reverse()
    await this.bindingService.softDeleteSourceBindings(createdSourceBindingIds)

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

    await this.assertWorkNameAvailable(dto.workDraft.name)
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

  // 为本次导入确认本地作品的三方来源绑定。
  private async bindWorkSource(
    dto: ThirdPartyComicImportRequestDto,
    detail: ThirdPartyComicDetailDto,
    workId: number,
    providerGroupPathWord: string,
    context: ThirdPartyComicImportTaskContext,
  ) {
    const sourceSnapshot = {
      ...dto.sourceSnapshot,
      providerComicId: detail.id,
      providerPathWord: detail.pathWord,
      providerGroupPathWord,
      uuid: detail.uuid,
      fetchedAt:
        typeof dto.sourceSnapshot.fetchedAt === 'string'
          ? dto.sourceSnapshot.fetchedAt
        : new Date().toISOString(),
    }
    await this.assertSourceScopeAvailable(
      {
        platform: dto.platform,
        providerComicId: detail.id,
        providerGroupPathWord,
      },
      workId,
    )
    const sourceBinding = await this.bindingService.createOrGetSourceBinding({
      workId,
      platform: dto.platform,
      providerComicId: detail.id,
      providerPathWord: detail.pathWord,
      providerGroupPathWord,
      providerUuid: detail.uuid,
      sourceSnapshot,
    })

    if (sourceBinding.created) {
      await this.recordCreatedSourceBinding(context, sourceBinding.id)
    }

    return {
      id: sourceBinding.id,
      providerGroupPathWord,
    }
  }

  // 导入单个章节，章节失败会中断任务并交由后台任务回滚。
  private async importChapter(
    chapterPlan: ThirdPartyComicChapterImportPlan,
    workId: number,
    sourceBindingId: number,
    sourceGroup: string,
    context: ThirdPartyComicImportTaskContext,
    imageProgressReporter: BackgroundTaskProgressReporter,
  ) {
    const { chapter } = chapterPlan
    const localChapterId = await this.prepareChapter(
      chapter,
      workId,
      sourceBindingId,
      sourceGroup,
      context,
    )
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
    sourceBindingId: number,
    sourceGroup: string,
    context: ThirdPartyComicImportTaskContext,
  ) {
    let localChapterId: number
    if (chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE) {
      if (!chapter.targetChapterId) {
        throw new Error('更新章节必须选择目标章节')
      }
      await this.assertChapterTitleAvailable(
        workId,
        chapter.title,
        chapter.targetChapterId,
      )
      await this.appendResidueList(
        context,
        'updatedChapters',
        await this.readChapterSnapshot(chapter.targetChapterId),
      )
      await this.workChapterService.updateChapter({
        id: chapter.targetChapterId,
        ...this.toChapterUpdate(chapter),
      })
      localChapterId = chapter.targetChapterId
    } else {
      await this.assertChapterTitleAvailable(workId, chapter.title)
      const createdChapterId =
        await this.workChapterService.createChapterReturningId({
          ...this.toChapterUpdate(chapter),
          workId,
          workType: WorkTypeEnum.COMIC,
        })
      await this.recordCreatedChapter(context, createdChapterId)
      localChapterId = createdChapterId
    }

    await this.recordChapterBinding(context, {
      chapterId: localChapterId,
      providerChapterId: chapter.providerChapterId,
      remoteSortOrder: chapter.sortOrder,
      snapshot: this.toChapterBindingSnapshot(chapter, sourceGroup),
      workThirdPartySourceBindingId: sourceBindingId,
    })

    return localChapterId
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

  // 解析预览和绑定使用的三方分组标识。
  private resolvePreviewGroup(group?: string) {
    return group?.trim() || 'default'
  }

  // 确认导入必须携带预览时生成的三方分组标识。
  private resolveSourceGroupFromSnapshot(
    sourceSnapshot: ThirdPartyComicSourceSnapshotDto,
  ) {
    const providerGroupPathWord = sourceSnapshot.providerGroupPathWord
    if (typeof providerGroupPathWord === 'string') {
      const normalizedGroup = providerGroupPathWord.trim()
      if (normalizedGroup) {
        return normalizedGroup
      }
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '三方来源分组缺失，请重新预览后再导入',
    )
  }

  // 构建导入任务 reservation，并在入队前完成本地冲突预检。
  async buildImportReservationSnapshot(
    dto: ThirdPartyComicImportRequestDto,
  ): Promise<ThirdPartyComicImportReservation> {
    const context = await this.resolveImportReservationContext(dto)
    return this.buildImportReservationFromContext(context)
  }

  private async buildImportReservation(
    dto: ThirdPartyComicImportRequestDto,
  ): Promise<ThirdPartyComicImportReservation> {
    const context = await this.resolveImportReservationContext(dto)
    await this.assertImportPreflight({
      dto,
      plannedWork: context.plannedWork,
      providerComicId: context.providerComicId,
      providerGroupPathWord: context.providerGroupPathWord,
    })
    return this.buildImportReservationFromContext(context)
  }

  private async resolveImportReservationContext(
    dto: ThirdPartyComicImportRequestDto,
  ): Promise<ThirdPartyComicImportReservationContext> {
    const platform = this.normalizeReservationText(dto.platform, '平台代码')
    const providerComicId = this.resolveProviderComicId(dto)
    const providerGroupPathWord = this.resolveSourceGroupFromSnapshot(
      dto.sourceSnapshot,
    )
    const plannedWork = await this.resolvePlannedWork(dto)
    const chapterTitles = this.resolveSubmittedChapterTitles(dto.chapters)

    return {
      dto,
      platform,
      providerComicId,
      providerGroupPathWord,
      plannedWork,
      chapterTitles,
    }
  }

  private buildImportReservationFromContext(
    context: ThirdPartyComicImportReservationContext,
  ): ThirdPartyComicImportReservation {
    const {
      chapterTitles,
      plannedWork,
      platform,
      providerComicId,
      providerGroupPathWord,
    } = context
    const sourceComicKey = this.buildSourceComicConflictKey(
      platform,
      providerComicId,
    )
    const sourceScopeKey = this.buildSourceScopeConflictKey(
      platform,
      providerComicId,
      providerGroupPathWord,
    )
    const conflictMessageByKey: Record<string, string> = {
      [sourceComicKey]: SOURCE_COMIC_CONFLICT_MESSAGE,
      [sourceScopeKey]: SOURCE_SCOPE_CONFLICT_MESSAGE,
    }

    const conflictKeys = [sourceComicKey, sourceScopeKey]
    const workNameKey = this.buildWorkNameConflictKey(plannedWork.name)
    conflictKeys.push(workNameKey)
    conflictMessageByKey[workNameKey] = WORK_NAME_CONFLICT_MESSAGE

    for (const chapterTitle of chapterTitles) {
      const workNameChapterKey = this.buildChapterTitleWorkNameConflictKey(
        plannedWork.name,
        chapterTitle,
      )
      conflictKeys.push(workNameChapterKey)
      conflictMessageByKey[workNameChapterKey] = CHAPTER_TITLE_CONFLICT_MESSAGE

      if (plannedWork.id !== null) {
        const workIdChapterKey = this.buildChapterTitleWorkIdConflictKey(
          plannedWork.id,
          chapterTitle,
        )
        conflictKeys.push(workIdChapterKey)
        conflictMessageByKey[workIdChapterKey] =
          CHAPTER_TITLE_CONFLICT_MESSAGE
      }
    }

    return {
      dedupeKey: sourceComicKey,
      dedupeConflictMessage: SOURCE_COMIC_CONFLICT_MESSAGE,
      serialKey: `platform:${platform}`,
      conflictKeys,
      conflictMessageByKey,
    }
  }

  private areSameStringSets(left: string[], right: string[]) {
    if (left.length !== right.length) {
      return false
    }
    const leftSet = new Set(left)
    if (leftSet.size !== left.length) {
      return false
    }
    return right.every((item) => leftSet.has(item))
  }

  private throwInvalidRetryReservationSnapshot(cause: unknown): never {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      INVALID_RETRY_RESERVATION_SNAPSHOT_MESSAGE,
      {
        cause: {
          code: INVALID_RETRY_RESERVATION_SNAPSHOT_CAUSE_CODE,
          detail:
            cause instanceof Error
              ? cause.message
              : 'reservation snapshot mismatch',
          value: cause,
        },
      },
    )
  }

  // 入队前按导入模式执行本地事实预检。
  private async assertImportPreflight(input: {
    dto: ThirdPartyComicImportRequestDto
    plannedWork: ThirdPartyComicImportPlannedWork
    providerComicId: string
    providerGroupPathWord: string
  }) {
    const { dto, plannedWork, providerComicId, providerGroupPathWord } = input
    if (dto.mode === ThirdPartyComicImportModeEnum.CREATE_NEW) {
      await this.assertWorkNameAvailable(plannedWork.name)
      await this.assertSourceScopeAvailable(
        {
          platform: dto.platform,
          providerComicId,
          providerGroupPathWord,
        },
        null,
      )
      return
    }

    if (plannedWork.id === null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '挂载已有作品必须选择目标作品',
      )
    }

    await this.assertSourceScopeAvailable(
      {
        platform: dto.platform,
        providerComicId,
        providerGroupPathWord,
      },
      plannedWork.id,
    )
    for (const chapter of dto.chapters) {
      await this.assertChapterTitleAvailable(
        plannedWork.id,
        chapter.title,
        chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE
          ? chapter.targetChapterId
          : undefined,
      )
    }
  }

  // 执行期在真实写入前重新检查本地冲突，避免排队期间状态漂移。
  private async assertImportStillAllowed(
    dto: ThirdPartyComicImportRequestDto,
    providerGroupPathWord: string,
  ) {
    const plannedWork = await this.resolvePlannedWork(dto)
    this.resolveSubmittedChapterTitles(dto.chapters)

    if (dto.mode === ThirdPartyComicImportModeEnum.CREATE_NEW) {
      await this.assertWorkNameAvailable(plannedWork.name)
      await this.assertSourceScopeAvailable(
        {
          platform: dto.platform,
          providerComicId: this.resolveProviderComicId(dto),
          providerGroupPathWord,
        },
        null,
      )
      return
    }

    if (plannedWork.id === null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '挂载已有作品必须选择目标作品',
      )
    }

    await this.assertSourceScopeAvailable(
      {
        platform: dto.platform,
        providerComicId: this.resolveProviderComicId(dto),
        providerGroupPathWord,
      },
      plannedWork.id,
    )
    for (const chapter of dto.chapters) {
      await this.assertChapterTitleAvailable(
        plannedWork.id,
        chapter.title,
        chapter.action === ThirdPartyComicImportChapterActionEnum.UPDATE
          ? chapter.targetChapterId
          : undefined,
      )
    }
  }

  // 解析本次导入计划要影响的本地作品。
  private async resolvePlannedWork(
    dto: ThirdPartyComicImportRequestDto,
  ): Promise<ThirdPartyComicImportPlannedWork> {
    if (dto.mode === ThirdPartyComicImportModeEnum.CREATE_NEW) {
      if (!dto.workDraft?.name) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '新建作品必须提交作品名称',
        )
      }
      return {
        id: null,
        name: this.normalizeReservationText(dto.workDraft.name, '作品名称'),
      }
    }

    if (!dto.targetWorkId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '挂载已有作品必须选择目标作品',
      )
    }
    const work = await this.readLiveComicWork(dto.targetWorkId)
    return {
      id: work.id,
      name: this.normalizeReservationText(work.name, '作品名称'),
    }
  }

  // 解析提交章节标题并阻断同一提交内的重复标题。
  private resolveSubmittedChapterTitles(
    chapters: ThirdPartyComicImportChapterItemDto[],
  ) {
    const titles: string[] = []
    const seenTitles = new Set<string>()
    for (const chapter of chapters) {
      const title = this.normalizeReservationText(chapter.title, '章节标题')
      if (seenTitles.has(title)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          `提交章节存在同名标题：${title}`,
        )
      }
      seenTitles.add(title)
      titles.push(title)
    }
    return titles
  }

  // 确认同名漫画作品当前不存在。
  private async assertWorkNameAvailable(workName: string) {
    const existingWork = await this.findLiveComicWorkByName(workName)
    if (existingWork) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '同名漫画作品已存在，不能重复导入',
      )
    }
  }

  // 确认三方来源作用域未被其他作品占用，允许目标作品上的同 scope 幂等复用。
  private async assertSourceScopeAvailable(
    source: {
      platform: string
      providerComicId: string
      providerGroupPathWord: string
    },
    allowedWorkId: number | null,
  ) {
    const binding = await this.bindingService.getActiveSourceBindingByScope(
      source,
    )
    if (!binding) {
      return
    }
    if (allowedWorkId !== null && binding.workId === allowedWorkId) {
      return
    }
    throw new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '三方来源已绑定其他作品，不能重复绑定',
    )
  }

  // 确认目标作品下没有同名 live 章节，更新时允许目标章节自身。
  private async assertChapterTitleAvailable(
    workId: number,
    chapterTitle: string,
    allowedChapterId?: number,
  ) {
    const existingChapter = await this.findLiveChapterByTitle(
      workId,
      chapterTitle,
      allowedChapterId,
    )
    if (existingChapter) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '目标作品下已存在同名章节，不能重复导入',
      )
    }
  }

  // 读取 live 漫画作品。
  private async readLiveComicWork(workId: number) {
    const [work] = await this.db
      .select({
        id: this.work.id,
        name: this.work.name,
        type: this.work.type,
      })
      .from(this.work)
      .where(and(eq(this.work.id, workId), isNull(this.work.deletedAt)))
      .limit(1)

    if (!work || work.type !== WorkTypeEnum.COMIC) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '漫画作品不存在',
      )
    }
    return work
  }

  // 按规范化作品名读取 live 漫画作品。
  private async findLiveComicWorkByName(workName: string) {
    const normalizedName = this.normalizeReservationText(workName, '作品名称')
    const [work] = await this.db
      .select({ id: this.work.id })
      .from(this.work)
      .where(
        and(
          eq(this.work.type, WorkTypeEnum.COMIC),
          isNull(this.work.deletedAt),
          sql`regexp_replace(trim(${this.work.name}), '\s+', ' ', 'g') = ${normalizedName}`,
        ),
      )
      .limit(1)

    return work ?? null
  }

  // 按规范化标题读取目标作品下的 live 章节。
  private async findLiveChapterByTitle(
    workId: number,
    chapterTitle: string,
    allowedChapterId?: number,
  ) {
    const normalizedTitle = this.normalizeReservationText(
      chapterTitle,
      '章节标题',
    )
    const conditions = [
      eq(this.workChapter.workId, workId),
      isNull(this.workChapter.deletedAt),
      sql`regexp_replace(trim(${this.workChapter.title}), '\s+', ' ', 'g') = ${normalizedTitle}`,
    ]
    if (allowedChapterId) {
      conditions.push(ne(this.workChapter.id, allowedChapterId))
    }

    const [chapter] = await this.db
      .select({ id: this.workChapter.id })
      .from(this.workChapter)
      .where(and(...conditions))
      .limit(1)

    return chapter ?? null
  }

  // 解析三方漫画 ID，优先使用预览快照里的 providerComicId。
  private resolveProviderComicId(dto: ThirdPartyComicImportRequestDto) {
    return this.normalizeReservationText(
      dto.sourceSnapshot.providerComicId || dto.comicId,
      '三方漫画ID',
    )
  }

  // 归一化 reservation 文本，保持 trim 和连续空白折叠一致。
  private normalizeReservationText(value: string | undefined, label: string) {
    const normalizedValue = value?.trim().replace(/\s+/g, ' ')
    if (!normalizedValue) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        `${label}不能为空`,
      )
    }
    return normalizedValue
  }

  // 构建同源三方作品冲突键。
  private buildSourceComicConflictKey(platform: string, providerComicId: string) {
    return `source-comic:${platform}:${providerComicId}`
  }

  // 构建三方来源作用域冲突键。
  private buildSourceScopeConflictKey(
    platform: string,
    providerComicId: string,
    providerGroupPathWord: string,
  ) {
    return `source-scope:${platform}:${providerComicId}:${providerGroupPathWord}`
  }

  // 构建漫画作品名冲突键。
  private buildWorkNameConflictKey(workName: string) {
    return `work-name:comic:${workName}`
  }

  // 构建按作品名聚合的章节标题冲突键。
  private buildChapterTitleWorkNameConflictKey(
    workName: string,
    chapterTitle: string,
  ) {
    return `chapter-title:comic:work-name:${workName}:${chapterTitle}`
  }

  // 构建按作品 ID 聚合的章节标题冲突键。
  private buildChapterTitleWorkIdConflictKey(
    workId: number,
    chapterTitle: string,
  ) {
    return `chapter-title:comic:work-id:${workId}:${chapterTitle}`
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

  // 将三方章节信息落入 binding 快照，后续同步不依赖章节标题猜测。
  private toChapterBindingSnapshot(
    chapter: ThirdPartyComicImportChapterItemDto,
    sourceGroup: string,
  ) {
    return {
      title: chapter.title,
      group: chapter.group?.trim() || sourceGroup,
      sortOrder: chapter.sortOrder,
      chapterApiVersion: chapter.chapterApiVersion ?? null,
      datetimeCreated: chapter.datetimeCreated ?? null,
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

  // 记录新建来源绑定；若记录失败则立即软删除刚创建的绑定。
  private async recordCreatedSourceBinding(
    context: ThirdPartyComicImportTaskContext,
    sourceBindingId: number,
  ) {
    try {
      await this.appendResidueList(
        context,
        'createdSourceBindingIds',
        sourceBindingId,
      )
    } catch (error) {
      await this.bindingService.softDeleteSourceBindings([sourceBindingId])
      throw error
    }
  }

  // 创建并记录章节绑定；若残留记录失败则立即软删除刚创建的绑定。
  private async recordChapterBinding(
    context: ThirdPartyComicImportTaskContext,
    input: ThirdPartyComicChapterBindingInput,
  ) {
    const binding = await this.bindingService.createOrGetChapterBinding(input)
    if (!binding.created) {
      return
    }

    try {
      await this.appendResidueList(
        context,
        'createdChapterBindingIds',
        binding.id,
      )
    } catch (error) {
      await this.bindingService.softDeleteChapterBindings([binding.id])
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
