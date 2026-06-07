import process from 'node:process'
import * as schema from '@db/schema'
import { FollowTargetTypeContractEnum } from '@libs/platform/constant'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import 'dotenv/config'

async function rebuildAuthorCounts() {
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
      update ${schema.workAuthor} as author
      set work_count = coalesce(fact.work_count, 0)
      from (
        select
          live_author.id as author_id,
          count(work_fact.id)::int as work_count
        from ${schema.workAuthor} as live_author
        left join ${schema.workAuthorRelation} as relation
          on relation.author_id = live_author.id
        left join ${schema.work} as work_fact
          on work_fact.id = relation.work_id
         and work_fact.deleted_at is null
        where live_author.deleted_at is null
        group by live_author.id
      ) as fact
      where author.id = fact.author_id
        and author.deleted_at is null
    `)

    console.log('作者粉丝数与作品数重建完成')
  } finally {
    await pool.end()
  }
}

rebuildAuthorCounts().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
