import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { applyCountDelta, CountDeltaFailureCauseCode } from '@db/extensions'
import {
  AuditStatusEnum,
  BusinessErrorCode,
  ContentTypeEnum,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type {
  RebuiltWorkChapterCounts,
  RebuiltWorkCounts,
  WorkChapterCountField,
  WorkCountField,
} from './work-counter.type'

/**
 * 内容域作品计数服务
 * 统一维护 work / work_chapter 相关对象计数，供各类交互 resolver 委托调用。
 */
@Injectable()
export class WorkCounterService {
  /**
   * 交互目标类型常量。
   * 这里保留内容域本地映射，避免 counter owner service 反向依赖 interaction 模块实现。
   */
  private readonly workComicTargetType = 1
  private readonly workNovelTargetType = 2
  private readonly chapterComicBrowseCommentTargetType = 3
  private readonly chapterNovelBrowseCommentTargetType = 4
  private readonly chapterComicLikeTargetType = 4
  private readonly chapterNovelLikeTargetType = 5
  private readonly chapterComicPurchaseDownloadTargetType = 1
  private readonly chapterNovelPurchaseDownloadTargetType = 2
  private readonly purchaseSuccessStatus = 1

  // 初始化 WorkCounterService 依赖。
  constructor(private readonly drizzle: DrizzleService) {}

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

  // 读取 userLike。
  private get userLike() {
    return this.drizzle.schema.userLike
  }

  // 读取 userFavorite。
  private get userFavorite() {
    return this.drizzle.schema.userFavorite
  }

  // 读取 userBrowseLog。
  private get userBrowseLog() {
    return this.drizzle.schema.userBrowseLog
  }

  // 读取 userComment。
  private get userComment() {
    return this.drizzle.schema.userComment
  }

  // 读取 userPurchaseRecord。
  private get userPurchaseRecord() {
    return this.drizzle.schema.userPurchaseRecord
  }

  // 读取 userDownloadRecord。
  private get userDownloadRecord() {
    return this.drizzle.schema.userDownloadRecord
  }

  // 执行 runCountUpdate。
  private async runCountUpdate(
    tx: Db | undefined,
    operation: (client: Db) => Promise<void>,
  ) {
    if (tx) {
      await operation(tx)
      return
    }

    await this.drizzle.withErrorHandling(async () => operation(this.db))
  }

  // 执行 rethrowNotFound。
  private rethrowNotFound(error: unknown, message: string): never {
    if (
      !(error instanceof BusinessException) ||
      error.code !== BusinessErrorCode.RESOURCE_NOT_FOUND
    ) {
      throw error
    }

    const causeCode =
      typeof error.cause === 'object' &&
      error.cause !== null &&
      'code' in error.cause
        ? (error.cause as { code?: unknown }).code
        : undefined

    if (causeCode === CountDeltaFailureCauseCode.INSUFFICIENT_COUNT) {
      throw error
    }

    if (causeCode === CountDeltaFailureCauseCode.TARGET_NOT_FOUND) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        message,
        {
          cause: error.cause ?? error,
        },
      )
    }

    throw error
  }

  // 执行 throwUnsupportedWorkType。
  private throwUnsupportedWorkType(): never {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的作品类型',
    )
  }

  // 获取 work Like Target Type。
  private getWorkLikeTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.workComicTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.workNovelTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Favorite Target Type。
  private getWorkFavoriteTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.workComicTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.workNovelTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Browse Target Type。
  private getWorkBrowseTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.workComicTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.workNovelTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Comment Target Type。
  private getWorkCommentTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.workComicTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.workNovelTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Chapter Like Target Type。
  private getWorkChapterLikeTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.chapterComicLikeTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.chapterNovelLikeTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Chapter Browse Target Type。
  private getWorkChapterBrowseTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.chapterComicBrowseCommentTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.chapterNovelBrowseCommentTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Chapter Comment Target Type。
  private getWorkChapterCommentTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.chapterComicBrowseCommentTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.chapterNovelBrowseCommentTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Chapter Purchase Target Type。
  private getWorkChapterPurchaseTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.chapterComicPurchaseDownloadTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.chapterNovelPurchaseDownloadTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 获取 work Chapter Download Target Type。
  private getWorkChapterDownloadTargetType(workType: number) {
    if (workType === ContentTypeEnum.COMIC) {
      return this.chapterComicPurchaseDownloadTargetType
    }
    if (workType === ContentTypeEnum.NOVEL) {
      return this.chapterNovelPurchaseDownloadTargetType
    }
    this.throwUnsupportedWorkType()
  }

  // 更新 work Count Field。
  private async updateWorkCountField(
    tx: Db | undefined,
    workId: number,
    workType: number,
    field: WorkCountField,
    delta: number,
    message: string,
  ) {
    if (delta === 0) {
      return
    }

    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.work,
        and(
          eq(this.work.id, workId),
          eq(this.work.type, workType),
          eq(this.work.isPublished, true),
          isNull(this.work.deletedAt),
        )!,
        field,
        delta,
      )

    try {
      await this.runCountUpdate(tx, execute)
    } catch (error) {
      this.rethrowNotFound(error, message)
    }
  }

  // 更新 work Chapter Count Field。
  private async updateWorkChapterCountField(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    field: WorkChapterCountField,
    delta: number,
    message: string,
  ) {
    if (delta === 0) {
      return
    }

    const execute = async (client: Db) =>
      applyCountDelta(
        client,
        this.workChapter,
        and(
          eq(this.workChapter.id, chapterId),
          eq(this.workChapter.workType, workType),
          isNull(this.workChapter.deletedAt),
        )!,
        field,
        delta,
      )

    try {
      await this.runCountUpdate(tx, execute)
    } catch (error) {
      this.rethrowNotFound(error, message)
    }
  }

  // 更新 work Like Count。
  async updateWorkLikeCount(
    tx: Db | undefined,
    workId: number,
    workType: number,
    delta: number,
    message = '作品不存在',
  ) {
    await this.updateWorkCountField(
      tx,
      workId,
      workType,
      'likeCount',
      delta,
      message,
    )
  }

  // 更新 work Favorite Count。
  async updateWorkFavoriteCount(
    tx: Db | undefined,
    workId: number,
    workType: number,
    delta: number,
    message = '作品不存在',
  ) {
    await this.updateWorkCountField(
      tx,
      workId,
      workType,
      'favoriteCount',
      delta,
      message,
    )
  }

  // 更新 work Comment Count。
  async updateWorkCommentCount(
    tx: Db | undefined,
    workId: number,
    workType: number,
    delta: number,
    message = '作品不存在',
  ) {
    await this.updateWorkCountField(
      tx,
      workId,
      workType,
      'commentCount',
      delta,
      message,
    )
  }

  // 更新 work View Count。
  async updateWorkViewCount(
    tx: Db | undefined,
    workId: number,
    workType: number,
    delta: number,
    message = '作品不存在',
  ) {
    await this.updateWorkCountField(
      tx,
      workId,
      workType,
      'viewCount',
      delta,
      message,
    )
  }

  // 更新 work Download Count。
  async updateWorkDownloadCount(
    tx: Db | undefined,
    workId: number,
    workType: number,
    delta: number,
    message = '作品不存在',
  ) {
    await this.updateWorkCountField(
      tx,
      workId,
      workType,
      'downloadCount',
      delta,
      message,
    )
  }

  // 更新 work Chapter Like Count。
  async updateWorkChapterLikeCount(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    delta: number,
    message = '章节不存在',
  ) {
    await this.updateWorkChapterCountField(
      tx,
      chapterId,
      workType,
      'likeCount',
      delta,
      message,
    )
  }

  // 更新 work Chapter Comment Count。
  async updateWorkChapterCommentCount(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    delta: number,
    message = '章节不存在',
  ) {
    await this.updateWorkChapterCountField(
      tx,
      chapterId,
      workType,
      'commentCount',
      delta,
      message,
    )
  }

  // 更新 work Chapter View Count。
  async updateWorkChapterViewCount(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    delta: number,
    message = '章节不存在',
  ) {
    await this.updateWorkChapterCountField(
      tx,
      chapterId,
      workType,
      'viewCount',
      delta,
      message,
    )
  }

  // 更新 work Chapter Purchase Count。
  async updateWorkChapterPurchaseCount(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    delta: number,
    message = '章节不存在',
  ) {
    await this.updateWorkChapterCountField(
      tx,
      chapterId,
      workType,
      'purchaseCount',
      delta,
      message,
    )
  }

  // 更新 work Chapter Download Count。
  async updateWorkChapterDownloadCount(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    delta: number,
    message = '章节不存在',
  ) {
    await this.updateWorkChapterCountField(
      tx,
      chapterId,
      workType,
      'downloadCount',
      delta,
      message,
    )
  }

  // 下载记录写入后，同时维护章节与所属作品的下载计数，作品级 downloadCount 的口径定义为“作品下所有章节下载记录总数”。
  async updateWorkDownloadCountsByChapter(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
    delta: number,
    chapterMessage = '章节不存在',
    workMessage = '作品不存在',
  ) {
    if (delta === 0) {
      return
    }

    const execute = async (client: Db) => {
      const chapter = await client.query.workChapter.findFirst({
        where: {
          id: chapterId,
          workType,
          deletedAt: { isNull: true },
        },
        columns: {
          workId: true,
        },
      })

      if (!chapter) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          chapterMessage,
        )
      }

      try {
        await applyCountDelta(
          client,
          this.workChapter,
          and(
            eq(this.workChapter.id, chapterId),
            eq(this.workChapter.workType, workType),
            isNull(this.workChapter.deletedAt),
          )!,
          'downloadCount',
          delta,
        )
      } catch (error) {
        this.rethrowNotFound(error, chapterMessage)
      }

      try {
        await applyCountDelta(
          client,
          this.work,
          and(
            eq(this.work.id, chapter.workId),
            eq(this.work.type, workType),
            eq(this.work.isPublished, true),
            isNull(this.work.deletedAt),
          )!,
          'downloadCount',
          delta,
        )
      } catch (error) {
        this.rethrowNotFound(error, workMessage)
      }
    }

    if (tx) {
      await execute(tx)
      return
    }

    await this.drizzle.withErrorHandling(async () =>
      this.db.transaction(async (transactionTx) => execute(transactionTx)),
    )
  }

  // 根据点赞/收藏/浏览/评论/下载事实表重建作品对象计数，评分属于作品元数据，不由计数 owner service 维护。
  async rebuildWorkCounts(
    tx: Db | undefined,
    workId: number,
    workType: number,
  ): Promise<RebuiltWorkCounts> {
    const client = tx ?? this.db
    const likeTargetType = this.getWorkLikeTargetType(workType)
    const favoriteTargetType = this.getWorkFavoriteTargetType(workType)
    const browseTargetType = this.getWorkBrowseTargetType(workType)
    const commentTargetType = this.getWorkCommentTargetType(workType)
    const downloadTargetType = this.getWorkChapterDownloadTargetType(workType)

    const [likeCount, favoriteCount, viewCount, commentCount, downloadRow] =
      await Promise.all([
        client.$count(
          this.userLike,
          and(
            eq(this.userLike.targetType, likeTargetType),
            eq(this.userLike.targetId, workId),
          ),
        ),
        client.$count(
          this.userFavorite,
          and(
            eq(this.userFavorite.targetType, favoriteTargetType),
            eq(this.userFavorite.targetId, workId),
          ),
        ),
        client.$count(
          this.userBrowseLog,
          and(
            eq(this.userBrowseLog.targetType, browseTargetType),
            eq(this.userBrowseLog.targetId, workId),
          ),
        ),
        client.$count(
          this.userComment,
          and(
            eq(this.userComment.targetType, commentTargetType),
            eq(this.userComment.targetId, workId),
            eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
            eq(this.userComment.isHidden, false),
            isNull(this.userComment.deletedAt),
          ),
        ),
        client
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(this.userDownloadRecord)
          .innerJoin(
            this.workChapter,
            and(
              eq(this.workChapter.id, this.userDownloadRecord.targetId),
              eq(this.workChapter.workId, workId),
              eq(this.workChapter.workType, workType),
              isNull(this.workChapter.deletedAt),
            ),
          )
          .where(eq(this.userDownloadRecord.targetType, downloadTargetType))
          .then((rows) => rows[0]),
      ])
    const downloadCount = Number(downloadRow?.count ?? 0)

    const persist = async (executor: Db) =>
      executor
        .update(this.work)
        .set({
          viewCount,
          likeCount,
          favoriteCount,
          commentCount,
          downloadCount,
        })
        .where(
          and(
            eq(this.work.id, workId),
            eq(this.work.type, workType),
            isNull(this.work.deletedAt),
          ),
        )

    const result = tx
      ? await persist(tx)
      : await this.drizzle.withErrorHandling(async () => persist(this.db))
    this.drizzle.assertAffectedRows(result, '作品不存在')

    return {
      workId,
      workType,
      viewCount,
      likeCount,
      favoriteCount,
      commentCount,
      downloadCount,
    }
  }

  // 根据点赞/浏览/评论/购买/下载事实表重建章节对象计数。
  async rebuildWorkChapterCounts(
    tx: Db | undefined,
    chapterId: number,
    workType: number,
  ): Promise<RebuiltWorkChapterCounts> {
    const client = tx ?? this.db
    const likeTargetType = this.getWorkChapterLikeTargetType(workType)
    const browseTargetType = this.getWorkChapterBrowseTargetType(workType)
    const commentTargetType = this.getWorkChapterCommentTargetType(workType)
    const purchaseTargetType = this.getWorkChapterPurchaseTargetType(workType)
    const downloadTargetType = this.getWorkChapterDownloadTargetType(workType)

    const [likeCount, viewCount, commentCount, purchaseCount, downloadCount] =
      await Promise.all([
        client.$count(
          this.userLike,
          and(
            eq(this.userLike.targetType, likeTargetType),
            eq(this.userLike.targetId, chapterId),
          ),
        ),
        client.$count(
          this.userBrowseLog,
          and(
            eq(this.userBrowseLog.targetType, browseTargetType),
            eq(this.userBrowseLog.targetId, chapterId),
          ),
        ),
        client.$count(
          this.userComment,
          and(
            eq(this.userComment.targetType, commentTargetType),
            eq(this.userComment.targetId, chapterId),
            eq(this.userComment.auditStatus, AuditStatusEnum.APPROVED),
            eq(this.userComment.isHidden, false),
            isNull(this.userComment.deletedAt),
          ),
        ),
        client.$count(
          this.userPurchaseRecord,
          and(
            eq(this.userPurchaseRecord.targetType, purchaseTargetType),
            eq(this.userPurchaseRecord.targetId, chapterId),
            eq(this.userPurchaseRecord.status, this.purchaseSuccessStatus),
          ),
        ),
        client.$count(
          this.userDownloadRecord,
          and(
            eq(this.userDownloadRecord.targetType, downloadTargetType),
            eq(this.userDownloadRecord.targetId, chapterId),
          ),
        ),
      ])

    const persist = async (executor: Db) =>
      executor
        .update(this.workChapter)
        .set({
          viewCount,
          likeCount,
          commentCount,
          purchaseCount,
          downloadCount,
        })
        .where(
          and(
            eq(this.workChapter.id, chapterId),
            eq(this.workChapter.workType, workType),
            isNull(this.workChapter.deletedAt),
          ),
        )

    const result = tx
      ? await persist(tx)
      : await this.drizzle.withErrorHandling(async () => persist(this.db))
    this.drizzle.assertAffectedRows(result, '章节不存在')

    return {
      chapterId,
      workType,
      viewCount,
      likeCount,
      commentCount,
      purchaseCount,
      downloadCount,
    }
  }
}
