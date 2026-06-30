import process from 'node:process'
import * as schema from '@db/schema'
import { FollowTargetTypeContractEnum } from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import 'dotenv/config'

async function rebuildFollowCounts() {
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
      { count: affectedUsers },
      { count: affectedAuthors },
      { count: affectedSections },
      { count: affectedHashtags },
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.appUser)
        .where(sql`${schema.appUser.deletedAt} is null`)
        .then((rows) => rows[0]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workAuthor)
        .where(sql`${schema.workAuthor.deletedAt} is null`)
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
      insert into ${schema.appUserCount} (
        user_id,
        following_user_count,
        following_author_count,
        following_section_count,
        following_hashtag_count,
        followers_count,
        created_at,
        updated_at
      )
      select
        live_user.id,
        coalesce(following.following_user_count, 0),
        coalesce(following.following_author_count, 0),
        coalesce(following.following_section_count, 0),
        coalesce(following.following_hashtag_count, 0),
        coalesce(followers.followers_count, 0),
        now(),
        now()
      from ${schema.appUser} as live_user
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
      where live_user.deleted_at is null
      on conflict (user_id) do update set
        following_user_count = excluded.following_user_count,
        following_author_count = excluded.following_author_count,
        following_section_count = excluded.following_section_count,
        following_hashtag_count = excluded.following_hashtag_count,
        followers_count = excluded.followers_count,
        updated_at = now()
    `)

    await db.execute(sql`
      update ${schema.workAuthor} as author
      set followers_count = coalesce(fact.followers_count, 0)
      from (
        select
          live_author.id as author_id,
          count(follow.target_id)::int as followers_count
        from ${schema.workAuthor} as live_author
        left join ${schema.userFollow} as follow
          on follow.target_type = ${FollowTargetTypeContractEnum.AUTHOR}
         and follow.target_id = live_author.id
        where live_author.deleted_at is null
        group by live_author.id
      ) as fact
      where author.id = fact.author_id
        and author.deleted_at is null
    `)

    await db.execute(sql`
      update ${schema.forumSection} as section
      set followers_count = coalesce(fact.followers_count, 0)
      from (
        select
          live_section.id as section_id,
          count(follow.target_id)::int as followers_count
        from ${schema.forumSection} as live_section
        left join ${schema.userFollow} as follow
          on follow.target_type = ${FollowTargetTypeContractEnum.FORUM_SECTION}
         and follow.target_id = live_section.id
        where live_section.deleted_at is null
        group by live_section.id
      ) as fact
      where section.id = fact.section_id
        and section.deleted_at is null
    `)

    await db.execute(sql`
      update ${schema.forumHashtag} as hashtag
      set follower_count = coalesce(fact.follower_count, 0)
      from (
        select
          live_hashtag.id as hashtag_id,
          count(follow.target_id)::int as follower_count
        from ${schema.forumHashtag} as live_hashtag
        left join ${schema.userFollow} as follow
          on follow.target_type = ${FollowTargetTypeContractEnum.FORUM_HASHTAG}
         and follow.target_id = live_hashtag.id
        where live_hashtag.deleted_at is null
        group by live_hashtag.id
      ) as fact
      where hashtag.id = fact.hashtag_id
        and hashtag.deleted_at is null
    `)

    console.log(
      `关注派生计数重建完成：affectedUsers=${Number(affectedUsers ?? 0)}, affectedAuthors=${Number(affectedAuthors ?? 0)}, affectedSections=${Number(affectedSections ?? 0)}, affectedHashtags=${Number(affectedHashtags ?? 0)}, elapsedMs=${Date.now() - startedAt}`,
    )
  } finally {
    await pool.end()
  }
}

rebuildFollowCounts().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
