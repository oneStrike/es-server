import process from 'node:process'
import * as schema from '@db/schema'
import { FavoriteTargetTypeEnum } from '@libs/interaction/favorite/favorite.constant'
import { LikeTargetTypeEnum } from '@libs/interaction/like/like.constant'
import { FollowTargetTypeContractEnum } from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import 'dotenv/config'

async function rebuildAppUserCounts() {
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
    const [{ count: affectedUsers }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.appUser)
      .where(sql`${schema.appUser.deletedAt} is null`)

    await db.execute(sql`
      insert into ${schema.appUserCount} (
        user_id,
        comment_count,
        like_count,
        favorite_count,
        following_user_count,
        following_author_count,
        following_section_count,
        following_hashtag_count,
        followers_count,
        forum_topic_count,
        comment_received_like_count,
        forum_topic_received_like_count,
        forum_topic_received_favorite_count,
        created_at,
        updated_at
      )
      select
        live_user.id,
        coalesce(comment_fact.comment_count, 0),
        coalesce(like_fact.like_count, 0),
        coalesce(favorite_fact.favorite_count, 0),
        coalesce(following.following_user_count, 0),
        coalesce(following.following_author_count, 0),
        coalesce(following.following_section_count, 0),
        coalesce(following.following_hashtag_count, 0),
        coalesce(followers.followers_count, 0),
        coalesce(topic_fact.forum_topic_count, 0),
        coalesce(comment_like_fact.comment_received_like_count, 0),
        coalesce(topic_like_fact.forum_topic_received_like_count, 0),
        coalesce(topic_favorite_fact.forum_topic_received_favorite_count, 0),
        now(),
        now()
      from ${schema.appUser} as live_user
      left join (
        select comment.user_id, count(*)::int as comment_count
        from ${schema.userComment} as comment
        where comment.deleted_at is null
        group by comment.user_id
      ) as comment_fact on comment_fact.user_id = live_user.id
      left join (
        select likes.user_id, count(*)::int as like_count
        from ${schema.userLike} as likes
        group by likes.user_id
      ) as like_fact on like_fact.user_id = live_user.id
      left join (
        select favorite.user_id, count(*)::int as favorite_count
        from ${schema.userFavorite} as favorite
        group by favorite.user_id
      ) as favorite_fact on favorite_fact.user_id = live_user.id
      left join (
        select
          follow.user_id,
          count(*) filter (where follow.target_type = ${FollowTargetTypeContractEnum.USER})::int as following_user_count,
          count(*) filter (where follow.target_type = ${FollowTargetTypeContractEnum.AUTHOR})::int as following_author_count,
          count(*) filter (where follow.target_type = ${FollowTargetTypeContractEnum.FORUM_SECTION})::int as following_section_count,
          count(*) filter (where follow.target_type = ${FollowTargetTypeContractEnum.FORUM_HASHTAG})::int as following_hashtag_count
        from ${schema.userFollow} as follow
        group by follow.user_id
      ) as following on following.user_id = live_user.id
      left join (
        select follow.target_id as user_id, count(*)::int as followers_count
        from ${schema.userFollow} as follow
        where follow.target_type = ${FollowTargetTypeContractEnum.USER}
        group by follow.target_id
      ) as followers on followers.user_id = live_user.id
      left join (
        select topic.user_id, count(*)::int as forum_topic_count
        from ${schema.forumTopic} as topic
        where topic.deleted_at is null
        group by topic.user_id
      ) as topic_fact on topic_fact.user_id = live_user.id
      left join (
        select comment.user_id, count(likes.id)::int as comment_received_like_count
        from ${schema.userLike} as likes
        inner join ${schema.userComment} as comment
          on comment.id = likes.target_id
         and comment.deleted_at is null
        where likes.target_type = ${LikeTargetTypeEnum.COMMENT}
        group by comment.user_id
      ) as comment_like_fact on comment_like_fact.user_id = live_user.id
      left join (
        select topic.user_id, count(likes.id)::int as forum_topic_received_like_count
        from ${schema.userLike} as likes
        inner join ${schema.forumTopic} as topic
          on topic.id = likes.target_id
         and topic.deleted_at is null
        where likes.target_type = ${LikeTargetTypeEnum.FORUM_TOPIC}
        group by topic.user_id
      ) as topic_like_fact on topic_like_fact.user_id = live_user.id
      left join (
        select topic.user_id, count(favorite.id)::int as forum_topic_received_favorite_count
        from ${schema.userFavorite} as favorite
        inner join ${schema.forumTopic} as topic
          on topic.id = favorite.target_id
         and topic.deleted_at is null
        where favorite.target_type = ${FavoriteTargetTypeEnum.FORUM_TOPIC}
        group by topic.user_id
      ) as topic_favorite_fact on topic_favorite_fact.user_id = live_user.id
      where live_user.deleted_at is null
      on conflict (user_id) do update set
        comment_count = excluded.comment_count,
        like_count = excluded.like_count,
        favorite_count = excluded.favorite_count,
        following_user_count = excluded.following_user_count,
        following_author_count = excluded.following_author_count,
        following_section_count = excluded.following_section_count,
        following_hashtag_count = excluded.following_hashtag_count,
        followers_count = excluded.followers_count,
        forum_topic_count = excluded.forum_topic_count,
        comment_received_like_count = excluded.comment_received_like_count,
        forum_topic_received_like_count = excluded.forum_topic_received_like_count,
        forum_topic_received_favorite_count = excluded.forum_topic_received_favorite_count,
        updated_at = now()
    `)

    console.log(
      `应用用户聚合计数重建完成：affectedUsers=${Number(affectedUsers ?? 0)}, elapsedMs=${Date.now() - startedAt}`,
    )
  } finally {
    await pool.end()
  }
}

rebuildAppUserCounts().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
