import type { Db } from '@db/core'
import { DrizzleService } from '@db/core'
import { FollowTargetTypeEnum } from '@libs/interaction/follow/follow.constant'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { ForumHashtagReferenceSourceTypeEnum } from './forum-hashtag.constant'

/**
 * forum 话题计数服务。
 * 统一重建引用数、关注数和最近引用时间，避免写路径各自手工维护。
 */
@Injectable()
export class ForumHashtagCounterService {
  constructor(private readonly drizzle: DrizzleService) {}

  private get forumHashtag() {
    return this.drizzle.schema.forumHashtag
  }

  private get forumHashtagReference() {
    return this.drizzle.schema.forumHashtagReference
  }

  private get userFollow() {
    return this.drizzle.schema.userFollow
  }

  // 重建指定话题的冗余统计字段。
  async rebuildHashtagStatsInTx(tx: Db, hashtagIds: number[]) {
    const uniqueHashtagIds = [...new Set(hashtagIds)]
    if (uniqueHashtagIds.length === 0) {
      return
    }

    const [referenceRows, followerRows] = await Promise.all([
      tx
        .select({
          hashtagId: this.forumHashtagReference.hashtagId,
          topicRefCount: sql<number>`sum(case when ${this.forumHashtagReference.isSourceVisible} = true and ${this.forumHashtagReference.sourceType} = ${ForumHashtagReferenceSourceTypeEnum.TOPIC} then 1 else 0 end)::int`,
          commentRefCount: sql<number>`sum(case when ${this.forumHashtagReference.isSourceVisible} = true and ${this.forumHashtagReference.sourceType} = ${ForumHashtagReferenceSourceTypeEnum.COMMENT} then 1 else 0 end)::int`,
          lastReferencedAt: sql<Date | null>`max(case when ${this.forumHashtagReference.isSourceVisible} = true then ${this.forumHashtagReference.createdAt} else null end)`,
        })
        .from(this.forumHashtagReference)
        .where(inArray(this.forumHashtagReference.hashtagId, uniqueHashtagIds))
        .groupBy(this.forumHashtagReference.hashtagId),
      tx
        .select({
          hashtagId: this.userFollow.targetId,
          followerCount: sql<number>`count(*)::int`,
        })
        .from(this.userFollow)
        .where(
          and(
            eq(this.userFollow.targetType, FollowTargetTypeEnum.FORUM_HASHTAG),
            inArray(this.userFollow.targetId, uniqueHashtagIds),
          ),
        )
        .groupBy(this.userFollow.targetId),
    ])

    const referenceMap = new Map(
      referenceRows.map((row) => [row.hashtagId, row] as const),
    )
    const followerMap = new Map(
      followerRows.map(
        (row) => [row.hashtagId, Number(row.followerCount)] as const,
      ),
    )

    for (const hashtagId of uniqueHashtagIds) {
      const reference = referenceMap.get(hashtagId)
      await tx
        .update(this.forumHashtag)
        .set({
          topicRefCount: Number(reference?.topicRefCount ?? 0),
          commentRefCount: Number(reference?.commentRefCount ?? 0),
          followerCount: followerMap.get(hashtagId) ?? 0,
          lastReferencedAt: reference?.lastReferencedAt ?? null,
        })
        .where(
          and(
            eq(this.forumHashtag.id, hashtagId),
            isNull(this.forumHashtag.deletedAt),
          ),
        )
    }
  }
}
