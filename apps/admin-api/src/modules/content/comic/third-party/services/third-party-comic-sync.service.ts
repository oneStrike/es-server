import type { Db } from '@db/core'
import type {
  ThirdPartyComicImageDto,
  ThirdPartyComicSyncLatestRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import type { ThirdPartyComicChapterBindingInput } from '@libs/content/work/third-party/third-party-comic-binding.type'
import type {
  ThirdPartyComicPreparedWorkflowSync,
  ThirdPartyComicSyncChapterPlan,
  ThirdPartyComicSyncChapterPlanBuildInput,
  ThirdPartyComicSyncImageImportProgressFile,
  ThirdPartyComicSyncImportNewChapterInput,
  ThirdPartyComicSyncResidue,
  ThirdPartyComicSyncTaskContext,
  ThirdPartyComicSyncTaskPayload,
  ThirdPartyComicSyncTaskResult,
  ThirdPartyComicWorkflowSyncTarget,
} from '@libs/content/work/third-party/third-party-comic-sync.type'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type { WorkflowObject } from '@libs/platform/modules/workflow/workflow.type'
import { DrizzleService } from '@db/core'
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ContentImportWorkflowType } from '@libs/content/work/content-import/content-import.constant'
import { ContentImportService } from '@libs/content/work/content-import/content-import.service'
import { ComicContentService } from '@libs/content/work/content/comic-content.service'
import { ComicThirdPartyRegistry } from '@libs/content/work/third-party/providers/comic-third-party.registry'
import { RemoteImageImportService } from '@libs/content/work/third-party/services/remote-image-import.service'
import { ThirdPartyComicBindingService } from '@libs/content/work/third-party/services/third-party-comic-binding.service'
import {
  BusinessErrorCode,
  WorkTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { WorkflowOperatorTypeEnum } from '@libs/platform/modules/workflow/workflow.constant'
import { WorkflowService } from '@libs/platform/modules/workflow/workflow.service'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'

const NO_SOURCE_BINDING_MESSAGE =
  '作品未绑定三方来源，当前破坏性版本不支持旧导入作品同步'

@Injectable()
export class ThirdPartyComicSyncService {
  // 注入同步所需的 provider、章节、内容、图片、binding 和 workflow 服务。
  constructor(
    private readonly registry: ComicThirdPartyRegistry,
    private readonly workChapterService: WorkChapterService,
    private readonly comicContentService: ComicContentService,
    private readonly remoteImageImportService: RemoteImageImportService,
    private readonly bindingService: ThirdPartyComicBindingService,
    private readonly workflowService: WorkflowService,
    private readonly contentImportService: ContentImportService,
    private readonly drizzle: DrizzleService,
  ) {}

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

  // 管理员手动触发最新章节同步，只创建一个同 scope 互斥的 workflow 任务。
  async syncLatest(dto: ThirdPartyComicSyncLatestRequestDto, userId: number) {
    const sourceBinding =
      await this.bindingService.getActiveSourceBindingByWorkId(dto.workId)
    if (!sourceBinding) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        NO_SOURCE_BINDING_MESSAGE,
      )
    }
    const work = await this.readSyncWork(sourceBinding.workId)

    const sourceScopeKey =
      this.bindingService.buildSourceScopeKey(sourceBinding)
    const payload: ThirdPartyComicSyncTaskPayload = {
      workId: sourceBinding.workId,
      sourceBindingId: sourceBinding.id,
      platform: sourceBinding.platform,
      providerComicId: sourceBinding.providerComicId,
      providerPathWord: sourceBinding.providerPathWord,
      providerGroupPathWord: sourceBinding.providerGroupPathWord,
      sourceScopeKey,
    }

    const job = await this.workflowService.createDraft({
      workflowType: ContentImportWorkflowType.THIRD_PARTY_SYNC,
      displayName: work.name,
      operator: {
        type: WorkflowOperatorTypeEnum.ADMIN,
        userId,
      },
      selectedItemCount: 0,
      summary: {
        sourceType: ContentImportWorkflowType.THIRD_PARTY_SYNC,
      },
      conflictKeys: [`source-scope:${sourceScopeKey}`],
    })
    await this.contentImportService.createThirdPartySyncJob({
      jobId: job.jobId,
      dto,
      source: payload,
    })
    return this.workflowService.confirmDraft({ jobId: job.jobId })
  }

  // 执行最新章节同步 workflow，严格只创建未绑定章节。
  async executeSyncTask(
    payload: ThirdPartyComicSyncTaskPayload,
    context: ThirdPartyComicSyncTaskContext,
  ): Promise<ThirdPartyComicSyncTaskResult> {
    const prepared = await this.prepareWorkflowSync(payload, context)
    const imageProgressReporter = this.createSyncImageProgressReporter(
      context,
      prepared.plans,
    )

    const createdChapterIds: number[] = []
    for (const plan of prepared.plans) {
      await context.assertNotCancelled()
      createdChapterIds.push(
        await this.importWorkflowSyncChapter({
          context,
          imageProgressReporter,
          plan,
          sourceBindingId: prepared.sourceBindingId,
          work: prepared.work,
        }),
      )
    }

    await context.updateProgress({
      percent: 100,
      message: '第三方漫画最新章节同步完成',
    })

    return {
      workId: payload.workId,
      sourceBindingId: prepared.sourceBindingId,
      scannedChapterCount: prepared.scannedChapterCount,
      skippedChapterCount: prepared.skippedChapterCount,
      createdChapterCount: createdChapterIds.length,
      createdChapterIds,
    }
  }

  // 准备 workflow 同步目标和待创建章节计划。
  async prepareWorkflowSync(
    payload: ThirdPartyComicSyncTaskPayload,
    context: ThirdPartyComicSyncTaskContext,
  ): Promise<ThirdPartyComicPreparedWorkflowSync> {
    const target = await this.prepareWorkflowSyncTarget(payload)
    const sourceBinding = await this.bindingService.getActiveSourceBindingById(
      payload.sourceBindingId,
    )
    if (!sourceBinding || sourceBinding.workId !== payload.workId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        NO_SOURCE_BINDING_MESSAGE,
      )
    }

    const provider = this.registry.resolve(sourceBinding.platform)
    const remoteChapters = await provider.getChapters({
      comicId: sourceBinding.providerPathWord,
      group: sourceBinding.providerGroupPathWord,
      platform: sourceBinding.platform,
    })
    const existingBindings =
      await this.bindingService.listActiveChapterBindings(sourceBinding.id)
    const boundProviderChapterIds = new Set(
      existingBindings.map((binding) => binding.providerChapterId),
    )
    const newRemoteChapters = remoteChapters.filter(
      (chapter) => !boundProviderChapterIds.has(chapter.providerChapterId),
    )

    const localSortOrders = await this.readActiveSortOrders(payload.workId)
    const plans = await this.buildChapterPlans({
      chapters: newRemoteChapters,
      comicId: sourceBinding.providerPathWord,
      group: sourceBinding.providerGroupPathWord,
      platform: sourceBinding.platform,
      usedSortOrders: localSortOrders,
      context,
    })

    return {
      ...target,
      createdChapterCount: plans.length,
      plans,
      scannedChapterCount: remoteChapters.length,
      skippedChapterCount: remoteChapters.length - plans.length,
    }
  }

  // 准备 workflow 同步的本地目标，不扫描上游章节。
  async prepareWorkflowSyncTarget(
    payload: ThirdPartyComicSyncTaskPayload,
  ): Promise<ThirdPartyComicWorkflowSyncTarget> {
    const sourceBinding = await this.bindingService.getActiveSourceBindingById(
      payload.sourceBindingId,
    )
    if (!sourceBinding || sourceBinding.workId !== payload.workId) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        NO_SOURCE_BINDING_MESSAGE,
      )
    }

    const work = await this.readSyncWork(payload.workId)
    return {
      sourceBindingId: sourceBinding.id,
      work,
    }
  }

  // 为 workflow 同步创建图片导入进度 reporter。
  createSyncImageProgressReporter(
    context: ThirdPartyComicSyncTaskContext,
    plans: ThirdPartyComicSyncChapterPlan[],
  ) {
    return context.createProgressReporter({
      startPercent: 10,
      endPercent: 95,
      total: this.countPlannedImages(plans),
      stage: 'image-import',
      unit: 'image',
    })
  }

  // 执行 workflow 中的单章节同步导入。
  async importWorkflowSyncChapter(input: ThirdPartyComicSyncImportNewChapterInput) {
    return this.importNewChapter(input)
  }

  // 回滚失败或取消的最新章节同步任务。
  async rollbackSyncTask(context: ThirdPartyComicSyncTaskContext) {
    const residue = await context.getResidue()
    const createdChapterBindingIds = [
      ...(residue.createdChapterBindingIds ?? []),
    ].reverse()
    if (createdChapterBindingIds.length > 0) {
      await context.assertStillOwned()
      await this.bindingService.softDeleteChapterBindings(
        createdChapterBindingIds,
      )
    }

    const createdChapterIds = [...(residue.createdChapterIds ?? [])].reverse()
    if (createdChapterIds.length > 0) {
      await context.assertStillOwned()
      await this.workChapterService.deleteChapters(createdChapterIds)
    }

    const cleanupFailures: string[] = []
    for (const uploadedFile of [...(residue.uploadedFiles ?? [])].reverse()) {
      try {
        await context.assertStillOwned()
        await this.remoteImageImportService.deleteImportedFile(uploadedFile)
        await context.markUploadedFileResidueCleaned(uploadedFile)
      } catch (error) {
        await context
          .markUploadedFileResidueCleanupFailed(
            uploadedFile,
            this.stringifyUnknownError(error),
          )
          .catch(() => undefined)
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

  // 读取新章节内容并生成本地导入计划，确保远端读取失败早于本地写入副作用。
  private async buildChapterPlans(
    input: ThirdPartyComicSyncChapterPlanBuildInput,
  ) {
    const plans: ThirdPartyComicSyncChapterPlan[] = []
    let maxSortOrder = Math.max(0, ...input.usedSortOrders)
    const chapterTotal = input.chapters.length
    const planningReporter =
      chapterTotal > 0
        ? input.context.createProgressReporter({
            startPercent: 2,
            endPercent: 10,
            total: chapterTotal,
            stage: 'chapter-content',
            unit: 'chapter',
          })
        : undefined
    for (const [index, chapter] of input.chapters.entries()) {
      await input.context.assertNotCancelled()
      this.assertProviderChapterId(chapter.providerChapterId)
      const localSortOrder = this.resolveLocalSortOrder(
        chapter.sortOrder,
        input.usedSortOrders,
        maxSortOrder,
      )
      maxSortOrder = Math.max(maxSortOrder, localSortOrder)
      input.usedSortOrders.add(localSortOrder)
      const content = await this.registry
        .resolve(input.platform)
        .getChapterContent({
          chapterApiVersion: chapter.chapterApiVersion,
          chapterId: chapter.providerChapterId,
          comicId: input.comicId,
          group: input.group,
          platform: input.platform,
        })
      const images = this.sortImages(content.images)
      await planningReporter?.advance({
        current: index + 1,
        message: `已读取同步章节 ${index + 1}/${chapterTotal} 的内容`,
        detail: {
          providerChapterId: chapter.providerChapterId,
          chapterIndex: index + 1,
          chapterTotal,
        },
      })
      plans.push({
        providerChapterId: chapter.providerChapterId,
        title: chapter.title,
        group: chapter.group,
        sortOrder: chapter.sortOrder,
        chapterApiVersion: chapter.chapterApiVersion,
        datetimeCreated: chapter.datetimeCreated,
        localSortOrder,
        images,
        imageTotal: images.length,
        chapterIndex: index + 1,
        chapterTotal,
      })
    }
    return plans
  }

  // 创建本地章节、导入图片内容并记录三方章节绑定。
  private async importNewChapter(
    input: ThirdPartyComicSyncImportNewChapterInput,
  ) {
    const { context, imageProgressReporter, plan, sourceBindingId, work } =
      input
    const chapterId = await this.workChapterService.createChapterReturningId({
      canComment: work.canComment,
      canDownload: false,
      isPreview: false,
      isPublished: false,
      price: work.chapterPrice,
      sortOrder: plan.localSortOrder,
      title: plan.title,
      viewRule: WorkViewPermissionEnum.INHERIT,
      workId: work.id,
      workType: WorkTypeEnum.COMIC,
    })
    await this.recordCreatedChapter(context, chapterId)

    const filePaths = await this.remoteImageImportService.importImages(
      plan.images,
      ['work', 'comic', String(work.id), 'chapter', String(chapterId)],
      async (importedFile) => {
        await this.recordUploadedFile(context, importedFile.deleteTarget)
        await imageProgressReporter.advance({
          message: `已导入同步章节 ${plan.chapterIndex}/${plan.chapterTotal} 的第 ${importedFile.imageIndex}/${importedFile.imageTotal} 张图片`,
          detail: this.toImageProgressDetail(plan, importedFile),
        })
      },
    )
    await context.assertNotCancelled()

    await this.comicContentService.replaceChapterContents(chapterId, filePaths)
    await this.recordChapterBinding(context, {
      chapterId,
      providerChapterId: plan.providerChapterId,
      remoteSortOrder: plan.sortOrder,
      snapshot: this.toChapterBindingSnapshot(plan),
      workThirdPartySourceBindingId: sourceBindingId,
    })

    return chapterId
  }

  // 读取同步目标作品的最小创建字段，并阻断非漫画或已删除作品。
  private async readSyncWork(workId: number, db: Db = this.db) {
    const [work] = await db
      .select({
        id: this.work.id,
        name: this.work.name,
        type: this.work.type,
        chapterPrice: this.work.chapterPrice,
        canComment: this.work.canComment,
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

  // 读取作品当前 active 章节排序，供同步新章节时避开唯一索引冲突。
  private async readActiveSortOrders(workId: number) {
    const rows = await this.db
      .select({ sortOrder: this.workChapter.sortOrder })
      .from(this.workChapter)
      .where(
        and(
          eq(this.workChapter.workId, workId),
          isNull(this.workChapter.deletedAt),
        ),
      )

    return new Set(rows.map((row) => row.sortOrder))
  }

  // 若三方排序已被本地章节占用，则追加到当前最大排序之后。
  private resolveLocalSortOrder(
    remoteSortOrder: number,
    usedSortOrders: Set<number>,
    maxSortOrder: number,
  ) {
    if (!usedSortOrders.has(remoteSortOrder)) {
      return remoteSortOrder
    }
    return maxSortOrder + 1
  }

  // 将三方章节元数据落入绑定快照，供后续同步幂等诊断使用。
  private toChapterBindingSnapshot(plan: ThirdPartyComicSyncChapterPlan) {
    return {
      title: plan.title,
      group: plan.group ?? null,
      sortOrder: plan.sortOrder,
      chapterApiVersion: plan.chapterApiVersion ?? null,
      datetimeCreated: plan.datetimeCreated ?? null,
    }
  }

  // 将单张图片导入结果转换为可安全写入 workflow 进度的详情。
  private toImageProgressDetail(
    plan: ThirdPartyComicSyncChapterPlan,
    importedFile: ThirdPartyComicSyncImageImportProgressFile,
  ): WorkflowObject {
    return {
      providerChapterId: plan.providerChapterId,
      chapterIndex: plan.chapterIndex,
      chapterTotal: plan.chapterTotal,
      providerImageId: importedFile.image.providerImageId,
      imageIndex: importedFile.imageIndex,
      imageTotal: importedFile.imageTotal,
      safeSourceUrl: importedFile.safeSourceUrl,
      filePath: importedFile.filePath,
      fileSize: importedFile.fileSize,
      mimeType: importedFile.mimeType,
    }
  }

  // 统计本轮计划导入图片总量，作为后台进度映射分母。
  private countPlannedImages(plans: ThirdPartyComicSyncChapterPlan[]) {
    return plans.reduce((total, plan) => total + plan.imageTotal, 0)
  }

  // 按三方 sortOrder 保持图片导入顺序稳定。
  private sortImages(images: ThirdPartyComicImageDto[]) {
    return [...images].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // 提前阻断空白 provider 章节 ID，避免写入无法诊断的章节绑定。
  private assertProviderChapterId(providerChapterId: string) {
    if (!providerChapterId.trim()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '三方章节ID不能为空',
      )
    }
  }

  // 记录已上传文件的删除句柄；记录失败时立即同步清理。
  private async recordUploadedFile(
    context: ThirdPartyComicSyncTaskContext,
    uploadedFile: UploadDeleteTarget,
  ) {
    try {
      await this.appendResidueList(context, 'uploadedFiles', uploadedFile)
    } catch (error) {
      await this.tryCleanupUploadedFile(uploadedFile, error)
      throw error
    }
  }

  // 记录新建章节；残留记录失败时立即删除章节。
  private async recordCreatedChapter(
    context: ThirdPartyComicSyncTaskContext,
    chapterId: number,
  ) {
    try {
      await this.appendResidueList(context, 'createdChapterIds', chapterId)
    } catch (error) {
      await this.workChapterService.deleteChapters([chapterId])
      throw error
    }
  }

  // 创建并记录章节绑定；残留记录失败时立即软删除刚创建的绑定。
  private async recordChapterBinding(
    context: ThirdPartyComicSyncTaskContext,
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

  // 向同步残留对象中的数组字段追加一项。
  private async appendResidueList<
    TKey extends keyof ThirdPartyComicSyncResidue,
  >(
    context: ThirdPartyComicSyncTaskContext,
    key: TKey,
    value: NonNullable<ThirdPartyComicSyncResidue[TKey]> extends Array<
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
    } as Partial<ThirdPartyComicSyncResidue>)
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
}
