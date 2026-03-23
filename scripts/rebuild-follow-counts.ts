import type { DynamicModule } from '@nestjs/common'
import process from 'node:process'
import { DrizzleModule, DrizzleService } from '@db/core'
import { WorkAuthorModule, WorkAuthorService } from '@libs/content/author'
import { ForumCounterModule, ForumCounterService } from '@libs/forum/counter'
import { DbConfigRegister } from '@libs/platform/config'
import { getEnv } from '@libs/platform/utils'
import { AppUserCountService, UserModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { asc, isNull } from 'drizzle-orm'

type FollowCountScope = 'all' | 'user' | 'author' | 'section'

interface CliOptions {
  help: boolean
  scope: FollowCountScope
  batchSize: number
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let help = false
  let scope: FollowCountScope = 'all'
  let batchSize = 200

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    if (arg === '--scope' && nextArg) {
      if (
        nextArg === 'all'
        || nextArg === 'user'
        || nextArg === 'author'
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
  console.log('Usage: pnpm db:repair:follow-counts [--scope all|user|author|section] [--batch-size 200]')
  console.log('Examples:')
  console.log('  pnpm db:repair:follow-counts')
  console.log('  pnpm db:repair:follow-counts --scope user --batch-size 100')
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
class FollowCountRepairModule {
  static register(): DynamicModule {
    return {
      module: FollowCountRepairModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: resolveEnvFilePaths(),
          load: [DbConfigRegister],
        }),
        DrizzleModule,
        UserModule,
        ForumCounterModule,
        WorkAuthorModule,
      ],
    }
  }
}

async function processIdsInBatches(
  ids: number[],
  batchSize: number,
  handler: (ids: number[]) => Promise<void>,
) {
  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize)
    await handler(batch)
    console.log(
      `[follow-counts] processed ${Math.min(index + batch.length, ids.length)}/${ids.length}`,
    )
  }
}

async function rebuildUserFollowCounts(
  drizzle: DrizzleService,
  appUserCountService: AppUserCountService,
  batchSize: number,
) {
  const userIds = await drizzle.db
    .select({ id: drizzle.schema.appUser.id })
    .from(drizzle.schema.appUser)
    .where(isNull(drizzle.schema.appUser.deletedAt))
    .orderBy(asc(drizzle.schema.appUser.id))
    .then((rows) => rows.map((row) => row.id))

  console.log(`[follow-counts] rebuilding user counts, total=${userIds.length}`)
  await processIdsInBatches(userIds, batchSize, async (ids) => {
    await Promise.all(ids.map(async (userId) => appUserCountService.rebuildFollowCounts(undefined, userId)))
  })
}

async function rebuildAuthorFollowCounts(
  drizzle: DrizzleService,
  workAuthorService: WorkAuthorService,
  batchSize: number,
) {
  const authorIds = await drizzle.db
    .select({ id: drizzle.schema.workAuthor.id })
    .from(drizzle.schema.workAuthor)
    .where(isNull(drizzle.schema.workAuthor.deletedAt))
    .orderBy(asc(drizzle.schema.workAuthor.id))
    .then((rows) => rows.map((row) => row.id))

  console.log(`[follow-counts] rebuilding author counts, total=${authorIds.length}`)
  await processIdsInBatches(authorIds, batchSize, async (ids) => {
    await Promise.all(ids.map(async (authorId) => workAuthorService.rebuildAuthorFollowersCount(undefined, authorId)))
  })
}

async function rebuildSectionFollowCounts(
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

  console.log(`[follow-counts] rebuilding forum section counts, total=${sectionIds.length}`)
  await processIdsInBatches(sectionIds, batchSize, async (ids) => {
    await Promise.all(ids.map(async (sectionId) => forumCounterService.rebuildSectionFollowersCount(undefined, sectionId)))
  })
}

async function main() {
  const options = parseArgs()
  if (options.help) {
    printHelp()
    return
  }
  const app = await NestFactory.createApplicationContext(
    FollowCountRepairModule.register(),
    { logger: ['error', 'warn', 'log'] },
  )

  try {
    const drizzle = app.get(DrizzleService)
    const appUserCountService = app.get(AppUserCountService)
    const forumCounterService = app.get(ForumCounterService)
    const workAuthorService = app.get(WorkAuthorService)
    const startedAt = Date.now()

    console.log(
      `[follow-counts] start scope=${options.scope} batchSize=${options.batchSize}`,
    )

    if (options.scope === 'all' || options.scope === 'user') {
      await rebuildUserFollowCounts(
        drizzle,
        appUserCountService,
        options.batchSize,
      )
    }

    if (options.scope === 'all' || options.scope === 'author') {
      await rebuildAuthorFollowCounts(
        drizzle,
        workAuthorService,
        options.batchSize,
      )
    }

    if (options.scope === 'all' || options.scope === 'section') {
      await rebuildSectionFollowCounts(
        drizzle,
        forumCounterService,
        options.batchSize,
      )
    }

    console.log(`[follow-counts] done costMs=${Date.now() - startedAt}`)
  } finally {
    await app.close()
  }
}

void main()
