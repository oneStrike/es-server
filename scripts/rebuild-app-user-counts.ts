import type { DynamicModule } from '@nestjs/common'
import process from 'node:process'
import { DrizzleModule, DrizzleService } from '@db/core'
import { DbConfigRegister } from '@libs/platform/config'
import { getEnv } from '@libs/platform/utils'
import { AppUserCountService, UserModule } from '@libs/user'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { asc, isNull } from 'drizzle-orm'

interface CliOptions {
  help: boolean
  batchSize: number
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  let help = false
  let batchSize = 200

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

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

  return { help, batchSize }
}

function printHelp() {
  console.log('Usage: pnpm db:repair:app-user-counts [--batch-size 200]')
  console.log('Examples:')
  console.log('  pnpm db:repair:app-user-counts')
  console.log('  pnpm db:repair:app-user-counts --batch-size 100')
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
class AppUserCountRepairModule {
  static register(): DynamicModule {
    return {
      module: AppUserCountRepairModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          envFilePath: resolveEnvFilePaths(),
          load: [DbConfigRegister],
        }),
        DrizzleModule,
        UserModule,
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
      `[app-user-counts] processed ${Math.min(index + batch.length, ids.length)}/${ids.length}`,
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
    AppUserCountRepairModule.register(),
    { logger: ['error', 'warn', 'log'] },
  )

  try {
    const drizzle = app.get(DrizzleService)
    const appUserCountService = app.get(AppUserCountService)
    const startedAt = Date.now()
    const userIds = await drizzle.db
      .select({ id: drizzle.schema.appUser.id })
      .from(drizzle.schema.appUser)
      .where(isNull(drizzle.schema.appUser.deletedAt))
      .orderBy(asc(drizzle.schema.appUser.id))
      .then((rows) => rows.map((row) => row.id))

    console.log(
      `[app-user-counts] start total=${userIds.length} batchSize=${options.batchSize}`,
    )

    await processIdsInBatches(userIds, options.batchSize, async (ids) => {
      await Promise.all(
        ids.map(async (userId) =>
          appUserCountService.rebuildUserCounts(undefined, userId),
        ),
      )
    })

    console.log(`[app-user-counts] done costMs=${Date.now() - startedAt}`)
  } finally {
    await app.close()
  }
}

void main()
