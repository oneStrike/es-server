import type {
  ThirdPartyComicImageDto,
  ThirdPartyComicSyncLatestRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import type {
  BackgroundTaskObject,
  BackgroundTaskProgressReporter,
} from '@libs/platform/modules/background-task/types'
import type { UploadDeleteTarget } from '@libs/platform/modules/upload/upload.type'
import type {
  ThirdPartyComicSyncChapterPlanBuildInput,
  ThirdPartyComicSyncChapterPlan,
  ThirdPartyComicSyncImageImportProgressFile,
  ThirdPartyComicSyncImportNewChapterInput,
  ThirdPartyComicSyncResidue,
  ThirdPartyComicSyncTaskContext,
  ThirdPartyComicSyncTaskPayload,
  ThirdPartyComicSyncTaskResult,
} from '../third-party-comic-sync.type'
import { DrizzleService } from '@db/core'
import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ComicContentService } from '@libs/content/work/content/comic-content.service'
import {
  BusinessErrorCode,
  WorkTypeEnum,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  BackgroundTaskOperatorTypeEnum,
  BackgroundTaskStatusEnum,
} from '@libs/platform/modules/background-task/background-task.constant'
import { BackgroundTaskService } from '@libs/platform/modules/background-task/background-task.service'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { ComicThirdPartyRegistry } from '../providers/comic-third-party.registry'
import type { ThirdPartyComicChapterBindingInput } from '../third-party-comic-binding.type'
import { THIRD_PARTY_COMIC_SYNC_TASK_TYPE } from '../third-party-comic-sync.constant'
import { ThirdPartyComicBindingService } from './third-party-comic-binding.service'
import { RemoteImageImportService } from './remote-image-import.service'

const ACTIVE_SYNC_TASK_STATUSES = [
  BackgroundTaskStatusEnum.PENDING,
  BackgroundTaskStatusEnum.PROCESSING,
  BackgroundTaskStatusEnum.FINALIZING,
]
const NO_SOURCE_BINDING_MESSAGE =
  '作品未绑定三方来源，当前破坏性版本不支持旧导入作品同步'

@Injectable()
export class ThirdPartyComicSyncService {
  // 注入同步所需的 provider、章节、内容、图片、binding 和后台任务服务。
  constructor(
    private readonly registry: ComicThirdPartyRegistry,
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

  // 读取 work。
  private get work() {
    return this.drizzle.schema.work
  }

  // 读取 workChapter。
  private get workChapter() {
    return this.drizzle.schema.workChapter
  }

  // 读取 backgroundTask。
  private get backgroundTask() {
    return this.drizzle.schema.backgroundTask
  }

  // 管理员手动触发最新章节同步，只入队或返回已存在的同 scope active 任务。
  async syncLatest(dto: ThirdPartyComicSyncLatestRequestDto, userId: number) {
    const sourceBinding =
      await this.bindingService.getActiveSourceBindingByWorkId(dto.workId)
    if (!sourceBinding) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        NO_SOURCE_BINDING_MESSAGE,
      )
    }

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

    const enqueueResult = await this.drizzle.withTransaction(async (tx) => {
      // 用事务级 advisory lock 串行化同一 source-scope 的入队检查，避免并发请求同时创建同步任务。
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${sourceScopeKey}))`,
      )
      const [existingTask] = await tx
        .select({ taskId: this.backgroundTask.taskId })
        .from(this.backgroundTask)
        .where(
          and(
            eq(this.backgroundTask.taskType, THIRD_PARTY_COMIC_SYNC_TASK_TYPE),
            inArray(this.backgroundTask.status, ACTIVE_SYNC_TASK_STATUSES),
            // 现有后台任务 payload 未结构化成查询列，只在同事务锁保护下用 JSON 字段定位同 scope active 任务。
            sql`${this.backgroundTask.payload}->>'sourceScopeKey' = ${sourceScopeKey}`,
          ),
        )
        .limit(1)

      if (existingTask) {
        return { existingTaskId: existingTask.taskId }
      }

      return {
        task: await this.backgroundTaskService.createTaskInTransaction(
          {
            taskType: THIRD_PARTY_COMIC_SYNC_TASK_TYPE,
            payload,
            operator: {
              type: BackgroundTaskOperatorTypeEnum.ADMIN,
              userId,
            },
          },
          tx,
        ),
      }
    })

    if (enqueueResult.existingTaskId) {
      return this.backgroundTaskService.getTaskDetail({
        taskId: enqueueResult.existingTaskId,
      })
    }

    return enqueueResult.task
  }

  // 执行最新章节同步后台任务，严格只创建未绑定章节。
  async executeSyncTask(
    payload: ThirdPartyComicSyncTaskPayload,
    context: ThirdPartyComicSyncTaskContext,
  ): Promise<ThirdPartyComicSyncTaskResult> {
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
    const imageProgressReporter = context.createProgressReporter({
      startPercent: 10,
      endPercent: 95,
      total: this.countPlannedImages(plans),
      stage: 'image-import',
      unit: 'image',
    })

    const createdChapterIds: number[] = []
    for (const plan of plans) {
      await context.assertNotCancelled()
      createdChapterIds.push(
        await this.importNewChapter({
          context,
          imageProgressReporter,
          plan,
          sourceBindingId: sourceBinding.id,
          work,
        }),
      )
    }

    await context.updateProgress({
      percent: 100,
      message: '第三方漫画最新章节同步完成',
    })

    return {
      workId: payload.workId,
      sourceBindingId: sourceBinding.id,
      scannedChapterCount: remoteChapters.length,
      skippedChapterCount: remoteChapters.length - plans.length,
      createdChapterCount: createdChapterIds.length,
      createdChapterIds,
    }
  }

  // 回滚失败或取消的最新章节同步任务。
  async rollbackSyncTask(context: ThirdPartyComicSyncTaskContext) {
    const residue = await context.getResidue()
    await this.bindingService.softDeleteChapterBindings(
      [...(residue.createdChapterBindingIds ?? [])].reverse(),
    )

    const createdChapterIds = [...(residue.createdChapterIds ?? [])].reverse()
    if (createdChapterIds.length > 0) {
      await this.workChapterService.deleteChapters(createdChapterIds)
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

  // 读取新章节内容并生成本地导入计划，确保远端读取失败早于本地写入副作用。
  private async buildChapterPlans(
    input: ThirdPartyComicSyncChapterPlanBuildInput,
  ) {
    const plans: ThirdPartyComicSyncChapterPlan[] = []
    let maxSortOrder = Math.max(0, ...input.usedSortOrders)
    const chapterTotal = input.chapters.length
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
      isPublished: true,
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
  private async readSyncWork(workId: number) {
    const [work] = await this.db
      .select({
        id: this.work.id,
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

  // 将单张图片导入结果转换为可安全写入后台任务进度的详情。
  private toImageProgressDetail(
    plan: ThirdPartyComicSyncChapterPlan,
    importedFile: ThirdPartyComicSyncImageImportProgressFile,
  ): BackgroundTaskObject {
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
