import process from 'node:process'
import * as schema from '@db/schema'
import { ForumHashtagReferenceSourceTypeEnum } from '@libs/forum/hashtag/forum-hashtag.constant'
import { BrowseLogTargetTypeEnum } from '@libs/interaction/browse-log/browse-log.constant'
import { CommentTargetTypeEnum } from '@libs/interaction/comment/comment.constant'
import { DownloadTargetTypeEnum } from '@libs/interaction/download/download.constant'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import {
  AuditStatusEnum,
  ContentTypeEnum,
  FollowTargetTypeContractEnum,
} from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import 'dotenv/config'

const purchaseGrantSource = 1
const entitlementActiveStatus = 1

async function rebuildContentForumCounts() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 环境变量未设置')
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  const db = drizzle({
    client: pool,
    schema,
  })

  try {
    const startedAt = Date.now()
    const [
      { count: affectedWorks },
      { count: affectedChapters },
      { count: affectedTopics },
      { count: affectedSections },
      { count: affectedHashtags },
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.work)
        .where(sql`${schema.work.deletedAt} is null`)
        .then((rows) => rows[0]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workChapter)
        .where(sql`${schema.workChapter.deletedAt} is null`)
        .then((rows) => rows[0]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.forumTopic)
        .where(sql`${schema.forumTopic.deletedAt} is null`)
        .then((rows) => rows[0]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.forumSection)
        .where(sql`${schema.forumSection.deletedAt} is null`)
        .then((rows) => rows[0]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.forumHashtag)
        .where(sql`${schema.forumHashtag.deletedAt} is null`)
        .then((rows) => rows[0]),
    ])

    await db.execute(sql`
      update ${schema.work} as work
      set
        view_count = coalesce(fact.view_count, 0),
        like_count = coalesce(fact.like_count, 0),
        favorite_count = coalesce(fact.favorite_count, 0),
        comment_count = coalesce(fact.comment_count, 0),
        download_count = coalesce(fact.download_count, 0)
      from (
        select
          live_work.id as work_id,
          coalesce(like_fact.like_count, 0) as like_count,
          coalesce(favorite_fact.favorite_count, 0) as favorite_count,
          coalesce(browse_fact.view_count, 0) as view_count,
          coalesce(comment_fact.comment_count, 0) as comment_count,
          coalesce(download_fact.download_count, 0) as download_count
        from ${schema.work} as live_work
        left join (
          select target_type, target_id, count(*)::int as like_count
          from ${schema.userLike}
          group by target_type, target_id
        ) as like_fact
          on like_fact.target_id = live_work.id
         and like_fact.target_type = case live_work.type
           when ${ContentTypeEnum.COMIC} then ${LikeTargetTypeEnum.WORK_COMIC}
           when ${ContentTypeEnum.NOVEL} then ${LikeTargetTypeEnum.WORK_NOVEL}
         end
        left join (
          select target_type, target_id, count(*)::int as favorite_count
          from ${schema.userFavorite}
          group by target_type, target_id
        ) as favorite_fact
          on favorite_fact.target_id = live_work.id
         and favorite_fact.target_type = case live_work.type
           when ${ContentTypeEnum.COMIC} then ${FavoriteTargetTypeEnum.WORK_COMIC}
           when ${ContentTypeEnum.NOVEL} then ${FavoriteTargetTypeEnum.WORK_NOVEL}
         end
        left join (
          select target_type, target_id, count(*)::int as view_count
          from ${schema.userBrowseLog}
          group by target_type, target_id
        ) as browse_fact
          on browse_fact.target_id = live_work.id
         and browse_fact.target_type = case live_work.type
           when ${ContentTypeEnum.COMIC} then ${BrowseLogTargetTypeEnum.COMIC}
           when ${ContentTypeEnum.NOVEL} then ${BrowseLogTargetTypeEnum.NOVEL}
         end
        left join (
          select target_type, target_id, count(*)::int as comment_count
          from ${schema.userComment}
          where audit_status = ${AuditStatusEnum.APPROVED}
            and is_hidden = false
            and deleted_at is null
          group by target_type, target_id
        ) as comment_fact
          on comment_fact.target_id = live_work.id
         and comment_fact.target_type = case live_work.type
           when ${ContentTypeEnum.COMIC} then ${CommentTargetTypeEnum.COMIC}
           when ${ContentTypeEnum.NOVEL} then ${CommentTargetTypeEnum.NOVEL}
         end
        left join (
          select
            chapter.work_id,
            chapter.work_type,
            count(download.id)::int as download_count
          from ${schema.workChapter} as chapter
          left join ${schema.userDownloadRecord} as download
            on download.target_id = chapter.id
           and download.target_type = case chapter.work_type
             when ${ContentTypeEnum.COMIC} then ${DownloadTargetTypeEnum.COMIC_CHAPTER}
             when ${ContentTypeEnum.NOVEL} then ${DownloadTargetTypeEnum.NOVEL_CHAPTER}
           end
          where chapter.deleted_at is null
          group by chapter.work_id, chapter.work_type
        ) as download_fact
          on download_fact.work_id = live_work.id
         and download_fact.work_type = live_work.type
        where live_work.deleted_at is null
      ) as fact
      where work.id = fact.work_id
        and work.deleted_at is null
    `)

    await db.execute(sql`
      update ${schema.workChapter} as chapter
      set
        view_count = coalesce(fact.view_count, 0),
        like_count = coalesce(fact.like_count, 0),
        comment_count = coalesce(fact.comment_count, 0),
        purchase_count = coalesce(fact.purchase_count, 0),
        download_count = coalesce(fact.download_count, 0)
      from (
        select
          live_chapter.id as chapter_id,
          coalesce(like_fact.like_count, 0) as like_count,
          coalesce(browse_fact.view_count, 0) as view_count,
          coalesce(comment_fact.comment_count, 0) as comment_count,
          coalesce(purchase_fact.purchase_count, 0) as purchase_count,
          coalesce(download_fact.download_count, 0) as download_count
        from ${schema.workChapter} as live_chapter
        left join (
          select target_type, target_id, count(*)::int as like_count
          from ${schema.userLike}
          group by target_type, target_id
        ) as like_fact
          on like_fact.target_id = live_chapter.id
         and like_fact.target_type = case live_chapter.work_type
           when ${ContentTypeEnum.COMIC} then ${LikeTargetTypeEnum.WORK_COMIC_CHAPTER}
           when ${ContentTypeEnum.NOVEL} then ${LikeTargetTypeEnum.WORK_NOVEL_CHAPTER}
         end
        left join (
          select target_type, target_id, count(*)::int as view_count
          from ${schema.userBrowseLog}
          group by target_type, target_id
        ) as browse_fact
          on browse_fact.target_id = live_chapter.id
         and browse_fact.target_type = case live_chapter.work_type
           when ${ContentTypeEnum.COMIC} then ${BrowseLogTargetTypeEnum.COMIC_CHAPTER}
           when ${ContentTypeEnum.NOVEL} then ${BrowseLogTargetTypeEnum.NOVEL_CHAPTER}
         end
        left join (
          select target_type, target_id, count(*)::int as comment_count
          from ${schema.userComment}
          where audit_status = ${AuditStatusEnum.APPROVED}
            and is_hidden = false
            and deleted_at is null
          group by target_type, target_id
        ) as comment_fact
          on comment_fact.target_id = live_chapter.id
         and comment_fact.target_type = case live_chapter.work_type
           when ${ContentTypeEnum.COMIC} then ${CommentTargetTypeEnum.COMIC_CHAPTER}
           when ${ContentTypeEnum.NOVEL} then ${CommentTargetTypeEnum.NOVEL_CHAPTER}
         end
        left join (
          select target_type, target_id, count(*)::int as purchase_count
          from ${schema.userContentEntitlement}
          where grant_source = ${purchaseGrantSource}
            and status = ${entitlementActiveStatus}
          group by target_type, target_id
        ) as purchase_fact
          on purchase_fact.target_id = live_chapter.id
         and purchase_fact.target_type = case live_chapter.work_type
           when ${ContentTypeEnum.COMIC} then ${DownloadTargetTypeEnum.COMIC_CHAPTER}
           when ${ContentTypeEnum.NOVEL} then ${DownloadTargetTypeEnum.NOVEL_CHAPTER}
         end
        left join (
          select target_type, target_id, count(*)::int as download_count
          from ${schema.userDownloadRecord}
          group by target_type, target_id
        ) as download_fact
          on download_fact.target_id = live_chapter.id
         and download_fact.target_type = case live_chapter.work_type
           when ${ContentTypeEnum.COMIC} then ${DownloadTargetTypeEnum.COMIC_CHAPTER}
           when ${ContentTypeEnum.NOVEL} then ${DownloadTargetTypeEnum.NOVEL_CHAPTER}
         end
        where live_chapter.deleted_at is null
      ) as fact
      where chapter.id = fact.chapter_id
        and chapter.deleted_at is null
    `)

    await db.execute(sql`
      update ${schema.forumTopic} as topic
      set
        view_count = coalesce(fact.view_count, 0),
        like_count = coalesce(fact.like_count, 0),
        favorite_count = coalesce(fact.favorite_count, 0),
        comment_count = coalesce(fact.comment_count, 0),
        last_comment_at = fact.last_comment_at,
        last_comment_user_id = fact.last_comment_user_id
      from (
        select
          live_topic.id as topic_id,
          coalesce(like_fact.like_count, 0) as like_count,
          coalesce(favorite_fact.favorite_count, 0) as favorite_count,
          coalesce(browse_fact.view_count, 0) as view_count,
          coalesce(comment_fact.comment_count, 0) as comment_count,
          latest_comment.created_at as last_comment_at,
          latest_comment.user_id as last_comment_user_id
        from ${schema.forumTopic} as live_topic
        left join (
          select target_id, count(*)::int as like_count
          from ${schema.userLike}
          where target_type = ${LikeTargetTypeEnum.FORUM_TOPIC}
          group by target_id
        ) as like_fact on like_fact.target_id = live_topic.id
        left join (
          select target_id, count(*)::int as favorite_count
          from ${schema.userFavorite}
          where target_type = ${FavoriteTargetTypeEnum.FORUM_TOPIC}
          group by target_id
        ) as favorite_fact on favorite_fact.target_id = live_topic.id
        left join (
          select target_id, count(*)::int as view_count
          from ${schema.userBrowseLog}
          where target_type = ${BrowseLogTargetTypeEnum.FORUM_TOPIC}
          group by target_id
        ) as browse_fact on browse_fact.target_id = live_topic.id
        left join (
          select target_id, count(*)::int as comment_count
          from ${schema.userComment}
          where target_type = ${CommentTargetTypeEnum.FORUM_TOPIC}
            and audit_status = ${AuditStatusEnum.APPROVED}
            and is_hidden = false
            and deleted_at is null
          group by target_id
        ) as comment_fact on comment_fact.target_id = live_topic.id
        left join (
          select distinct on (target_id)
            target_id,
            user_id,
            created_at
          from ${schema.userComment}
          where target_type = ${CommentTargetTypeEnum.FORUM_TOPIC}
            and audit_status = ${AuditStatusEnum.APPROVED}
            and is_hidden = false
            and deleted_at is null
          order by target_id, created_at desc, id desc
        ) as latest_comment on latest_comment.target_id = live_topic.id
        where live_topic.deleted_at is null
      ) as fact
      where topic.id = fact.topic_id
        and topic.deleted_at is null
    `)

    await db.execute(sql`
      update ${schema.forumSection} as section
      set
        topic_count = coalesce(fact.topic_count, 0),
        comment_count = coalesce(fact.comment_count, 0),
        followers_count = coalesce(fact.followers_count, 0),
        last_topic_id = fact.last_topic_id,
        last_post_at = fact.last_post_at
      from (
        select
          live_section.id as section_id,
          coalesce(topic_summary.topic_count, 0) as topic_count,
          coalesce(topic_summary.comment_count, 0) as comment_count,
          coalesce(followers.followers_count, 0) as followers_count,
          latest_topic.id as last_topic_id,
          latest_topic.last_post_at as last_post_at
        from ${schema.forumSection} as live_section
        left join (
          select
            section_id,
            count(*)::int as topic_count,
            coalesce(sum(comment_count), 0)::int as comment_count
          from ${schema.forumTopic}
          where audit_status = ${AuditStatusEnum.APPROVED}
            and is_hidden = false
            and deleted_at is null
          group by section_id
        ) as topic_summary on topic_summary.section_id = live_section.id
        left join (
          select distinct on (section_id)
            section_id,
            id,
            coalesce(last_comment_at, created_at) as last_post_at
          from ${schema.forumTopic}
          where audit_status = ${AuditStatusEnum.APPROVED}
            and is_hidden = false
            and deleted_at is null
          order by section_id, coalesce(last_comment_at, created_at) desc, id desc
        ) as latest_topic on latest_topic.section_id = live_section.id
        left join (
          select target_id as section_id, count(*)::int as followers_count
          from ${schema.userFollow}
          where target_type = ${FollowTargetTypeContractEnum.FORUM_SECTION}
          group by target_id
        ) as followers on followers.section_id = live_section.id
        where live_section.deleted_at is null
      ) as fact
      where section.id = fact.section_id
        and section.deleted_at is null
    `)

    await db.execute(sql`
      update ${schema.forumHashtag} as hashtag
      set
        topic_ref_count = coalesce(fact.topic_ref_count, 0),
        comment_ref_count = coalesce(fact.comment_ref_count, 0),
        follower_count = coalesce(fact.follower_count, 0),
        last_referenced_at = fact.last_referenced_at
      from (
        select
          live_hashtag.id as hashtag_id,
          coalesce(reference_summary.topic_ref_count, 0) as topic_ref_count,
          coalesce(reference_summary.comment_ref_count, 0) as comment_ref_count,
          coalesce(followers.follower_count, 0) as follower_count,
          reference_summary.last_referenced_at
        from ${schema.forumHashtag} as live_hashtag
        left join (
          select
            hashtag_id,
            sum(case when is_source_visible = true and source_type = ${ForumHashtagReferenceSourceTypeEnum.TOPIC} then 1 else 0 end)::int as topic_ref_count,
            sum(case when is_source_visible = true and source_type = ${ForumHashtagReferenceSourceTypeEnum.COMMENT} then 1 else 0 end)::int as comment_ref_count,
            max(case when is_source_visible = true then created_at else null end) as last_referenced_at
          from ${schema.forumHashtagReference}
          group by hashtag_id
        ) as reference_summary on reference_summary.hashtag_id = live_hashtag.id
        left join (
          select target_id as hashtag_id, count(*)::int as follower_count
          from ${schema.userFollow}
          where target_type = ${FollowTargetTypeContractEnum.FORUM_HASHTAG}
          group by target_id
        ) as followers on followers.hashtag_id = live_hashtag.id
        where live_hashtag.deleted_at is null
      ) as fact
      where hashtag.id = fact.hashtag_id
        and hashtag.deleted_at is null
    `)

    console.log(
      `内容与论坛计数重建完成：affectedWorks=${Number(affectedWorks ?? 0)}, affectedChapters=${Number(affectedChapters ?? 0)}, affectedTopics=${Number(affectedTopics ?? 0)}, affectedSections=${Number(affectedSections ?? 0)}, affectedHashtags=${Number(affectedHashtags ?? 0)}, elapsedMs=${Date.now() - startedAt}`,
    )
  } finally {
    await pool.end()
  }
}

rebuildContentForumCounts().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
