import type { DynamicModule } from '@nestjs/common'
import process from 'node:process'
import { DrizzleModule, DrizzleService } from '@db/core'
import { WorkAuthorModule, WorkAuthorService } from '@libs/content/author'
import { DbConfigRegister } from '@libs/platform/config'
import { getEnv } from '@libs/platform/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { asc, isNull } from 'drizzle-orm'

type AuthorCountScope = 'all' | 'follow' | 'work'

interface CliOptions {
  help: boolean
  scope: AuthorCountScope
  batchSize: number
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let help = false
  let scope: AuthorCountScope = 'all'
  let batchSize = 200

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    if (arg === '--scope' && nextArg) {
      if (
        nextArg === 'all'
        || nextArg === 'follow'
        || nextArg === 'work'
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
  console.log('Usage: pnpm db:repair:author-counts [--scope all|follow|work] [--batch-size 200]')
  console.log('Examples:')
  console.log('  pnpm db:repair:author-counts')
  console.log('  pnpm db:repair:author-counts --scope work --batch-size 100')
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
class AuthorCountRepairModule {
  static register(): DynamicModule {
    return {
      module: AuthorCountRepairModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: resolveEnvFilePaths(),
          load: [DbConfigRegister],
        }),
        DrizzleModule,
        WorkAuthorModule,
      ],
    }
  }
}

async function processIdsInBatches(
  ids: number[],
  batchSize: number,
  label: string,
  handler: (ids: number[]) => Promise<void>,
) {
  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize)
    await handler(batch)
    console.log(
      `[author-counts] ${label} processed ${Math.min(index + batch.length, ids.length)}/${ids.length}`,
    )
  }
}

async function main() {
  const options = parseArgs()
  if (options.help) {
    printHelp()
    return
  }

  const app = await NestFactory.createApplicationContext(
    AuthorCountRepairModule.register(),
    { logger: ['error', 'warn', 'log'] },
  )

  try {
    const drizzle = app.get(DrizzleService)
    const workAuthorService = app.get(WorkAuthorService)
    const startedAt = Date.now()
    const authorIds = await drizzle.db
      .select({ id: drizzle.schema.workAuthor.id })
      .from(drizzle.schema.workAuthor)
      .where(isNull(drizzle.schema.workAuthor.deletedAt))
      .orderBy(asc(drizzle.schema.workAuthor.id))
      .then((rows) => rows.map((row) => row.id))

    console.log(
      `[author-counts] start scope=${options.scope} total=${authorIds.length} batchSize=${options.batchSize}`,
    )

    if (options.scope === 'all' || options.scope === 'follow') {
      await processIdsInBatches(authorIds, options.batchSize, 'follow', async (ids) => {
        await Promise.all(
          ids.map(async (authorId) =>
            workAuthorService.rebuildAuthorFollowersCount(undefined, authorId),
          ),
        )
      })
    }

    if (options.scope === 'all' || options.scope === 'work') {
      await processIdsInBatches(authorIds, options.batchSize, 'work', async (ids) => {
        await Promise.all(
          ids.map(async (authorId) =>
            workAuthorService.rebuildAuthorWorkCount(undefined, authorId),
          ),
        )
      })
    }

    console.log(`[author-counts] done costMs=${Date.now() - startedAt}`)
  } finally {
    await app.close()
  }
}

void main()
