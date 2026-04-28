import type {
  DeleteForumHashtagReferencesInTxInput,
  ReplaceForumHashtagReferencesInTxInput,
  SyncForumHashtagReferenceVisibilityInTxInput,
} from './forum-hashtag.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { ForumHashtagCounterService } from './forum-hashtag-counter.service'
import { ForumHashtagReferenceSourceTypeEnum } from './forum-hashtag.constant'

/**
 * forum 话题引用事实服务。
 * 统一负责替换、删除和同步 source 可见性，避免 topic/comment 链路各自维护。
 */
@Injectable()
export class ForumHashtagReferenceService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly forumHashtagCounterService: ForumHashtagCounterService,
  ) {}

  private get forumHashtagReference() {
    return this.drizzle.schema.forumHashtagReference
  }

  // 在事务内全量替换某个来源的 hashtag 引用事实。
  async replaceReferencesInTx(input: ReplaceForumHashtagReferencesInTxInput) {
    const existingRows = await input.tx
      .select({
        hashtagId: this.forumHashtagReference.hashtagId,
      })
      .from(this.forumHashtagReference)
      .where(
        and(
          eq(this.forumHashtagReference.sourceType, input.sourceType),
          eq(this.forumHashtagReference.sourceId, input.sourceId),
        ),
      )

    await input.tx
      .delete(this.forumHashtagReference)
      .where(
        and(
          eq(this.forumHashtagReference.sourceType, input.sourceType),
          eq(this.forumHashtagReference.sourceId, input.sourceId),
        ),
      )

    if (input.hashtagFacts.length > 0) {
      await input.tx.insert(this.forumHashtagReference).values(
        input.hashtagFacts.map((item) => ({
          hashtagId: item.hashtagId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          topicId: input.topicId,
          sectionId: input.sectionId,
          userId: input.userId,
          occurrenceCount: item.occurrenceCount,
          sourceAuditStatus: input.sourceAuditStatus,
          sourceIsHidden: input.sourceIsHidden,
          isSourceVisible: input.isSourceVisible,
        })),
      )
    }

    await this.forumHashtagCounterService.rebuildHashtagStatsInTx(input.tx, [
      ...existingRows.map((row) => row.hashtagId),
      ...input.hashtagFacts.map((item) => item.hashtagId),
    ])
  }

  // 在事务内删除一批来源的 hashtag 引用事实。
  async deleteReferencesInTx(input: DeleteForumHashtagReferencesInTxInput) {
    if (input.sourceIds.length === 0) {
      return
    }

    const rows = await input.tx
      .select({
        hashtagId: this.forumHashtagReference.hashtagId,
      })
      .from(this.forumHashtagReference)
      .where(
        and(
          eq(this.forumHashtagReference.sourceType, input.sourceType),
          input.sourceIds.length === 1
            ? eq(this.forumHashtagReference.sourceId, input.sourceIds[0])
            : inArray(this.forumHashtagReference.sourceId, input.sourceIds),
        ),
      )

    await input.tx
      .delete(this.forumHashtagReference)
      .where(
        and(
          eq(this.forumHashtagReference.sourceType, input.sourceType),
          input.sourceIds.length === 1
            ? eq(this.forumHashtagReference.sourceId, input.sourceIds[0])
            : inArray(this.forumHashtagReference.sourceId, input.sourceIds),
        ),
      )

    await this.forumHashtagCounterService.rebuildHashtagStatsInTx(
      input.tx,
      rows.map((row) => row.hashtagId),
    )
  }

  // 同步来源审核/隐藏状态变化后的公开可见性。
  async syncSourceVisibilityInTx(
    input: SyncForumHashtagReferenceVisibilityInTxInput,
  ) {
    const rows = await input.tx
      .select({
        hashtagId: this.forumHashtagReference.hashtagId,
      })
      .from(this.forumHashtagReference)
      .where(
        and(
          eq(this.forumHashtagReference.sourceType, input.sourceType),
          eq(this.forumHashtagReference.sourceId, input.sourceId),
        ),
      )

    if (rows.length === 0) {
      return
    }

    await input.tx
      .update(this.forumHashtagReference)
      .set({
        sourceAuditStatus: input.sourceAuditStatus,
        sourceIsHidden: input.sourceIsHidden,
        isSourceVisible: input.isSourceVisible,
      })
      .where(
        and(
          eq(this.forumHashtagReference.sourceType, input.sourceType),
          eq(this.forumHashtagReference.sourceId, input.sourceId),
        ),
      )

    await this.forumHashtagCounterService.rebuildHashtagStatsInTx(
      input.tx,
      rows.map((row) => row.hashtagId),
    )
  }

  // 同步某个主题下所有评论引用的可见性。
  async syncCommentVisibilityByTopicInTx(
    tx: DeleteForumHashtagReferencesInTxInput['tx'],
    topicId: number,
    parentTopicVisible: boolean,
  ) {
    const rows = await tx
      .select({
        hashtagId: this.forumHashtagReference.hashtagId,
      })
      .from(this.forumHashtagReference)
      .where(
        and(
          eq(
            this.forumHashtagReference.sourceType,
            ForumHashtagReferenceSourceTypeEnum.COMMENT,
          ),
          eq(this.forumHashtagReference.topicId, topicId),
        ),
      )

    if (rows.length === 0) {
      return
    }

    await tx
      .update(this.forumHashtagReference)
      .set({
        isSourceVisible: parentTopicVisible
          ? sql<boolean>`case when ${this.forumHashtagReference.sourceAuditStatus} = 1 and ${this.forumHashtagReference.sourceIsHidden} = false then true else false end`
          : false,
      })
      .where(
        and(
          eq(
            this.forumHashtagReference.sourceType,
            ForumHashtagReferenceSourceTypeEnum.COMMENT,
          ),
          eq(this.forumHashtagReference.topicId, topicId),
        ),
      )

    await this.forumHashtagCounterService.rebuildHashtagStatsInTx(
      tx,
      rows.map((row) => row.hashtagId),
    )
  }

  // 同步主题及其评论引用的板块归属。
  async syncSectionIdsByTopicInTx(
    tx: DeleteForumHashtagReferencesInTxInput['tx'],
    topicId: number,
    sectionId: number,
  ) {
    await tx
      .update(this.forumHashtagReference)
      .set({
        sectionId,
      })
      .where(eq(this.forumHashtagReference.topicId, topicId))
  }
}
