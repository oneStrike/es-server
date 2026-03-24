import type { DynamicModule } from '@nestjs/common'
import process from 'node:process'
import { DrizzleModule, DrizzleService } from '@db/core'
import { WorkCounterModule, WorkCounterService } from '@libs/content/work-counter'
import { ForumCounterModule, ForumCounterService } from '@libs/forum/counter'
import { DbConfigRegister } from '@libs/platform/config'
import { getEnv } from '@libs/platform/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { asc, isNull } from 'drizzle-orm'

type RepairScope = 'all' | 'work' | 'chapter' | 'topic' | 'section'

interface CliOptions {
  help: boolean
  scope: RepairScope
  batchSize: number
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let help = false
  let scope: RepairScope = 'all'
  let batchSize = 200

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    if (arg === '--scope' && nextArg) {
      if (
        nextArg === 'all'
        || nextArg === 'work'
        || nextArg === 'chapter'
        || nextArg === 'topic'
        || nextArg === 'section'
      ) {
        scope = nextArg
      } else {
        throw new Error(`不支持的 scope: ${nextArg}`)
      }
      i++
      continue
    }

    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }

    if (arg === '--batch-size' && nextArg) {
      const parsed = Number(nextArg)
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`batch-size 必须是正整数，当前值: ${nextArg}`)
      }
      batchSize = parsed
      i++
    }
  }

  return { help, scope, batchSize }
}

function printHelp() {
  console.log('Usage: pnpm db:repair:content-forum-counts [--scope all|work|chapter|topic|section] [--batch-size 200]')
  console.log('Examples:')
  console.log('  pnpm db:repair:content-forum-counts')
  console.log('  pnpm db:repair:content-forum-counts --scope topic --batch-size 100')
}

function resolveEnvFilePaths() {
  const env = getEnv()
  return [
    'apps/app-api/.env',
    `apps/app-api/.env.${env}`,
    '.env',
    `.env.${env}`,
  ]
}

@Module({})
class ContentForumCountRepairModule {
  static register(): DynamicModule {
    return {
      module: ContentForumCountRepairModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: resolveEnvFilePaths(),
          load: [DbConfigRegister],
        }),
        DrizzleModule,
        WorkCounterModule,
        ForumCounterModule,
      ],
    }
  }
}

async function processItemsInBatches<T>(
  items: T[],
  batchSize: number,
  label: string,
  handler: (items: T[]) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    await handler(batch)
    console.log(
      `[content-forum-counts] ${label} processed ${Math.min(index + batch.length, items.length)}/${items.length}`,
    )
  }
}

async function rebuildWorkCounts(
  drizzle: DrizzleService,
  workCounterService: WorkCounterService,
  batchSize: number,
) {
  const works = await drizzle.db
    .select({
      id: drizzle.schema.work.id,
      type: drizzle.schema.work.type,
    })
    .from(drizzle.schema.work)
    .where(isNull(drizzle.schema.work.deletedAt))
    .orderBy(asc(drizzle.schema.work.id))

  console.log(`[content-forum-counts] rebuilding work counts, total=${works.length}`)
  await processItemsInBatches(works, batchSize, 'work', async (items) => {
    await Promise.all(
      items.map(async (work) =>
        workCounterService.rebuildWorkCounts(undefined, work.id, work.type),
      ),
    )
  })
}

async function rebuildChapterCounts(
  drizzle: DrizzleService,
  workCounterService: WorkCounterService,
  batchSize: number,
) {
  const chapters = await drizzle.db
    .select({
      id: drizzle.schema.workChapter.id,
      workType: drizzle.schema.workChapter.workType,
    })
    .from(drizzle.schema.workChapter)
    .where(isNull(drizzle.schema.workChapter.deletedAt))
    .orderBy(asc(drizzle.schema.workChapter.id))

  console.log(`[content-forum-counts] rebuilding chapter counts, total=${chapters.length}`)
  await processItemsInBatches(chapters, batchSize, 'chapter', async (items) => {
    await Promise.all(
      items.map(async (chapter) =>
        workCounterService.rebuildWorkChapterCounts(
          undefined,
          chapter.id,
          chapter.workType,
        ),
      ),
    )
  })
}

async function rebuildTopicCounts(
  drizzle: DrizzleService,
  forumCounterService: ForumCounterService,
  batchSize: number,
) {
  const topicIds = await drizzle.db
    .select({ id: drizzle.schema.forumTopic.id })
    .from(drizzle.schema.forumTopic)
    .where(isNull(drizzle.schema.forumTopic.deletedAt))
    .orderBy(asc(drizzle.schema.forumTopic.id))
    .then((rows) => rows.map((row) => row.id))

  console.log(`[content-forum-counts] rebuilding forum topic counts, total=${topicIds.length}`)
  await processItemsInBatches(topicIds, batchSize, 'topic', async (ids) => {
    await Promise.all(
      ids.map(async (topicId) =>
        drizzle.db.transaction(async (tx) => {
          await forumCounterService.rebuildTopicInteractionCounts(tx, topicId)
          await forumCounterService.syncTopicCommentState(tx, topicId)
        }),
      ),
    )
  })
}

async function rebuildSectionVisibleCounts(
  drizzle: DrizzleService,
  forumCounterService: ForumCounterService,
  batchSize: number,
) {
  const sectionIds = await drizzle.db
    .select({ id: drizzle.schema.forumSection.id })
    .from(drizzle.schema.forumSection)
    .where(isNull(drizzle.schema.forumSection.deletedAt))
    .orderBy(asc(drizzle.schema.forumSection.id))
    .then((rows) => rows.map((row) => row.id))

  console.log(`[content-forum-counts] rebuilding forum section visible counts, total=${sectionIds.length}`)
  await processItemsInBatches(sectionIds, batchSize, 'section', async (ids) => {
    await Promise.all(
      ids.map(async (sectionId) =>
        forumCounterService.syncSectionVisibleState(undefined, sectionId),
      ),
    )
  })
}

async function main() {
  const options = parseArgs()
  if (options.help) {
    printHelp()
    return
  }

  const app = await NestFactory.createApplicationContext(
    ContentForumCountRepairModule.register(),
    { logger: ['error', 'warn', 'log'] },
  )

  try {
    const drizzle = app.get(DrizzleService)
    const workCounterService = app.get(WorkCounterService)
    const forumCounterService = app.get(ForumCounterService)
    const startedAt = Date.now()

    console.log(
      `[content-forum-counts] start scope=${options.scope} batchSize=${options.batchSize}`,
    )

    if (options.scope === 'all' || options.scope === 'work') {
      await rebuildWorkCounts(drizzle, workCounterService, options.batchSize)
    }

    if (options.scope === 'all' || options.scope === 'chapter') {
      await rebuildChapterCounts(
        drizzle,
        workCounterService,
        options.batchSize,
      )
    }

    if (options.scope === 'all' || options.scope === 'topic') {
      await rebuildTopicCounts(
        drizzle,
        forumCounterService,
        options.batchSize,
      )
    }

    if (
      options.scope === 'all'
      || options.scope === 'section'
      || options.scope === 'topic'
    ) {
      await rebuildSectionVisibleCounts(
        drizzle,
        forumCounterService,
        options.batchSize,
      )
    }

    console.log(
      `[content-forum-counts] done costMs=${Date.now() - startedAt}`,
    )
  } finally {
    await app.close()
  }
}

void main()
