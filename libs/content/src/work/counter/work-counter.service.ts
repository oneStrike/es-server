import type { Db, SQL } from '@db/core'
import type {
  RebuiltWorkChapterCounts,
  RebuiltWorkCounts,
  WorkChapterCountField,
  WorkCountField,
} from './work-counter.type'
import { DrizzleService } from '@db/core'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import {
  AuditStatusEnum,
  BusinessErrorCode,
  ContentTypeEnum,
} from '@libs/platform/constant'

import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { WorkCountDeltaFailureCauseCode } from './work-counter.constant'

/**
 * 内容域作品计数服务
 * 统一维护 work / work_chapter 相关对象计数，供各类交互 resolver 委托调用。
 */
@Injectable()
export class WorkCounterService {
  private readonly purchaseGrantSource = 1
  private readonly entitlementActiveStatus = 1

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

  // 读取 userContentEntitlement。
  private get userContentEntitlement() {
    return this.drizzle.schema.userContentEntitlement
  }

  // 读取 userDownloadRecord。
  private get userDownloadRecord() {
    return this.drizzle.schema.userDownloadRecord
  }

  // 在可选事务内执行计数更新，未传事务时统一进入共享错误处理。
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

  // 拒绝内容域当前不支持的作品类型，避免错误目标类型继续写入计数。
  private throwUnsupportedWorkType(): never {
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的作品类型',
    )
  }

  // 获取作品点赞目标类型。
  private getWorkLikeTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return LikeTargetTypeEnum.WORK_COMIC
      case ContentTypeEnum.NOVEL:
        return LikeTargetTypeEnum.WORK_NOVEL
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取作品收藏目标类型。
  private getWorkFavoriteTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return FavoriteTargetTypeEnum.WORK_COMIC
      case ContentTypeEnum.NOVEL:
        return FavoriteTargetTypeEnum.WORK_NOVEL
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取作品浏览目标类型。
  private getWorkBrowseTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return BrowseLogTargetTypeEnum.COMIC
      case ContentTypeEnum.NOVEL:
        return BrowseLogTargetTypeEnum.NOVEL
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取作品评论目标类型。
  private getWorkCommentTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return CommentTargetTypeEnum.COMIC
      case ContentTypeEnum.NOVEL:
        return CommentTargetTypeEnum.NOVEL
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取章节点赞目标类型。
  private getWorkChapterLikeTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return LikeTargetTypeEnum.WORK_COMIC_CHAPTER
      case ContentTypeEnum.NOVEL:
        return LikeTargetTypeEnum.WORK_NOVEL_CHAPTER
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取章节浏览目标类型。
  private getWorkChapterBrowseTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return BrowseLogTargetTypeEnum.COMIC_CHAPTER
      case ContentTypeEnum.NOVEL:
        return BrowseLogTargetTypeEnum.NOVEL_CHAPTER
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取章节评论目标类型。
  private getWorkChapterCommentTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return CommentTargetTypeEnum.COMIC_CHAPTER
      case ContentTypeEnum.NOVEL:
        return CommentTargetTypeEnum.NOVEL_CHAPTER
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取章节购买目标类型。
  private getWorkChapterPurchaseTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return DownloadTargetTypeEnum.COMIC_CHAPTER
      case ContentTypeEnum.NOVEL:
        return DownloadTargetTypeEnum.NOVEL_CHAPTER
      default:
        this.throwUnsupportedWorkType()
    }
  }

  // 获取章节下载目标类型。
  private getWorkChapterDownloadTargetType(workType: number) {
    switch (workType) {
      case ContentTypeEnum.COMIC:
        return DownloadTargetTypeEnum.COMIC_CHAPTER
      case ContentTypeEnum.NOVEL:
        return DownloadTargetTypeEnum.NOVEL_CHAPTER
      default:
        this.throwUnsupportedWorkType()
    }
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

    const where = and(
      eq(this.work.id, workId),
      eq(this.work.type, workType),
      eq(this.work.isPublished, true),
      isNull(this.work.deletedAt),
    )!
    await this.runCountUpdate(tx, async (client) => {
      await this.applyWorkCountDelta(client, where, field, delta, message)
    })
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

    const where = and(
      eq(this.workChapter.id, chapterId),
      eq(this.workChapter.workType, workType),
      isNull(this.workChapter.deletedAt),
    )!
    await this.runCountUpdate(tx, async (client) => {
      await this.applyWorkChapterCountDelta(
        client,
        where,
        field,
        delta,
        message,
      )
    })
  }

  // 为 work 表构造类型约束下的计数字段增减表达式。
  private buildWorkCountDelta(field: WorkCountField, delta: number) {
    const amount = Math.abs(delta)
    switch (field) {
      case 'viewCount':
        return {
          column: this.work.viewCount,
          set: {
            viewCount:
              delta > 0
                ? sql`${this.work.viewCount} + ${amount}`
                : sql`${this.work.viewCount} - ${amount}`,
          },
        }
      case 'favoriteCount':
        return {
          column: this.work.favoriteCount,
          set: {
            favoriteCount:
              delta > 0
                ? sql`${this.work.favoriteCount} + ${amount}`
                : sql`${this.work.favoriteCount} - ${amount}`,
          },
        }
      case 'likeCount':
        return {
          column: this.work.likeCount,
          set: {
            likeCount:
              delta > 0
                ? sql`${this.work.likeCount} + ${amount}`
                : sql`${this.work.likeCount} - ${amount}`,
          },
        }
      case 'commentCount':
        return {
          column: this.work.commentCount,
          set: {
            commentCount:
              delta > 0
                ? sql`${this.work.commentCount} + ${amount}`
                : sql`${this.work.commentCount} - ${amount}`,
          },
        }
      case 'downloadCount':
        return {
          column: this.work.downloadCount,
          set: {
            downloadCount:
              delta > 0
                ? sql`${this.work.downloadCount} + ${amount}`
                : sql`${this.work.downloadCount} - ${amount}`,
          },
        }
    }
  }

  // 为 work_chapter 表构造类型约束下的计数字段增减表达式。
  private buildWorkChapterCountDelta(
    field: WorkChapterCountField,
    delta: number,
  ) {
    const amount = Math.abs(delta)
    switch (field) {
      case 'viewCount':
        return {
          column: this.workChapter.viewCount,
          set: {
            viewCount:
              delta > 0
                ? sql`${this.workChapter.viewCount} + ${amount}`
                : sql`${this.workChapter.viewCount} - ${amount}`,
          },
        }
      case 'likeCount':
        return {
          column: this.workChapter.likeCount,
          set: {
            likeCount:
              delta > 0
                ? sql`${this.workChapter.likeCount} + ${amount}`
                : sql`${this.workChapter.likeCount} - ${amount}`,
          },
        }
      case 'commentCount':
        return {
          column: this.workChapter.commentCount,
          set: {
            commentCount:
              delta > 0
                ? sql`${this.workChapter.commentCount} + ${amount}`
                : sql`${this.workChapter.commentCount} - ${amount}`,
          },
        }
      case 'purchaseCount':
        return {
          column: this.workChapter.purchaseCount,
          set: {
            purchaseCount:
              delta > 0
                ? sql`${this.workChapter.purchaseCount} + ${amount}`
                : sql`${this.workChapter.purchaseCount} - ${amount}`,
          },
        }
      case 'downloadCount':
        return {
          column: this.workChapter.downloadCount,
          set: {
            downloadCount:
              delta > 0
                ? sql`${this.workChapter.downloadCount} + ${amount}`
                : sql`${this.workChapter.downloadCount} - ${amount}`,
          },
        }
    }
  }

  // 原子更新作品计数；负数增量不允许把计数扣成负数。
  private async applyWorkCountDelta(
    client: Db,
    where: SQL,
    field: WorkCountField,
    delta: number,
    message: string,
  ) {
    const amount = Math.abs(delta)
    const deltaQuery = this.buildWorkCountDelta(field, delta)
    const updateWhere =
      delta > 0 ? where : and(where, gte(deltaQuery.column, amount))!
    const updated = await client
      .update(this.work)
      .set(deltaQuery.set)
      .where(updateWhere)
      .returning({ id: this.work.id })
    await this.assertWorkCountUpdated(client, where, updated.length, message)
  }

  // 原子更新章节计数；负数增量不允许把计数扣成负数。
  private async applyWorkChapterCountDelta(
    client: Db,
    where: SQL,
    field: WorkChapterCountField,
    delta: number,
    message: string,
  ) {
    const amount = Math.abs(delta)
    const deltaQuery = this.buildWorkChapterCountDelta(field, delta)
    const updateWhere =
      delta > 0 ? where : and(where, gte(deltaQuery.column, amount))!
    const updated = await client
      .update(this.workChapter)
      .set(deltaQuery.set)
      .where(updateWhere)
      .returning({ id: this.workChapter.id })
    await this.assertWorkChapterCountUpdated(
      client,
      where,
      updated.length,
      message,
    )
  }

  // 保持作品计数旧语义：目标不存在使用调用方文案，扣减不足保留稳定错误。
  private async assertWorkCountUpdated(
    client: Db,
    where: SQL,
    updatedCount: number,
    message: string,
  ) {
    if (updatedCount > 0) {
      return
    }
    const [existing] = await client
      .select({ id: this.work.id })
      .from(this.work)
      .where(where)
      .limit(1)
    const causeCode = existing
      ? WorkCountDeltaFailureCauseCode.INSUFFICIENT_COUNT
      : WorkCountDeltaFailureCauseCode.TARGET_NOT_FOUND
    throw new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      existing ? '目标不存在或计数不足' : message,
      { cause: { code: causeCode } },
    )
  }

  // 保持章节计数旧语义：目标不存在使用调用方文案，扣减不足保留稳定错误。
  private async assertWorkChapterCountUpdated(
    client: Db,
    where: SQL,
    updatedCount: number,
    message: string,
  ) {
    if (updatedCount > 0) {
      return
    }
    const [existing] = await client
      .select({ id: this.workChapter.id })
      .from(this.workChapter)
      .where(where)
      .limit(1)
    const causeCode = existing
      ? WorkCountDeltaFailureCauseCode.INSUFFICIENT_COUNT
      : WorkCountDeltaFailureCauseCode.TARGET_NOT_FOUND
    throw new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      existing ? '目标不存在或计数不足' : message,
      { cause: { code: causeCode } },
    )
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

      await this.applyWorkChapterCountDelta(
        client,
        and(
          eq(this.workChapter.id, chapterId),
          eq(this.workChapter.workType, workType),
          isNull(this.workChapter.deletedAt),
        )!,
        'downloadCount',
        delta,
        chapterMessage,
      )

      await this.applyWorkCountDelta(
        client,
        and(
          eq(this.work.id, chapter.workId),
          eq(this.work.type, workType),
          eq(this.work.isPublished, true),
          isNull(this.work.deletedAt),
        )!,
        'downloadCount',
        delta,
        workMessage,
      )
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
          this.userContentEntitlement,
          and(
            eq(this.userContentEntitlement.targetType, purchaseTargetType),
            eq(this.userContentEntitlement.targetId, chapterId),
            eq(
              this.userContentEntitlement.grantSource,
              this.purchaseGrantSource,
            ),
            eq(
              this.userContentEntitlement.status,
              this.entitlementActiveStatus,
            ),
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
