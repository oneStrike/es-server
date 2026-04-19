import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { Pool } from 'pg'

type Stage = 'post-reset' | 'post-contract'

interface CheckResult {
  ok: boolean
  label: string
  details?: string
}

function parseStage(): Stage {
  const stageIndex = process.argv.indexOf('--stage')
  const stage = stageIndex >= 0 ? process.argv[stageIndex + 1] : 'post-reset'
  if (stage !== 'post-reset' && stage !== 'post-contract') {
    throw new Error(`Unsupported stage: ${stage}`)
  }
  return stage
}

async function tableExists(pool: Pool, tableName: string) {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS "exists"
    `,
    [tableName],
  )
  return result.rows[0]?.exists === true
}

async function tableCount(pool: Pool, tableName: string) {
  if (!(await tableExists(pool, tableName))) {
    return 0
  }
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS "count" FROM "${tableName}"`,
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function settlementTypeCount(pool: Pool, settlementType: number) {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM "growth_reward_settlement"
      WHERE "settlement_type" = $1
    `,
    [settlementType],
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function totalSettlementCount(pool: Pool) {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM "growth_reward_settlement"
    `,
  )
  return Number(result.rows[0]?.count ?? 0)
}

async function activeRoundCount(pool: Pool) {
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS "count"
      FROM "check_in_streak_round_config"
      WHERE "status" = 1
    `,
  )
  return Number(result.rows[0]?.count ?? 0)
}

function verifyContractFiles(): CheckResult[] {
  const adminControllerPath = resolve(
    process.cwd(),
    'apps/admin-api/src/modules/check-in/check-in.controller.ts',
  )
  const appControllerPath = resolve(
    process.cwd(),
    'apps/app-api/src/modules/check-in/check-in.controller.ts',
  )
  const legacyPlanDtoPath = resolve(
    process.cwd(),
    'libs/growth/src/check-in/dto/check-in-plan.dto.ts',
  )
  const legacyCycleDtoPath = resolve(
    process.cwd(),
    'libs/growth/src/check-in/dto/check-in-cycle.dto.ts',
  )

  const adminController = readFileSync(adminControllerPath, 'utf8')
  const appController = readFileSync(appControllerPath, 'utf8')

  return [
    {
      ok:
        adminController.includes('config/detail') &&
        !adminController.includes('plan/detail'),
      label:
        'admin controller routes switched to config/streak-round semantics',
    },
    {
      ok:
        appController.includes('app/check-in') &&
        !appController.includes('model: CheckInSummaryPlanDto'),
      label: 'app controller no longer references plan-shaped app contracts',
    },
    {
      ok: !existsSync(legacyPlanDtoPath) && !existsSync(legacyCycleDtoPath),
      label: 'legacy plan/cycle DTO files removed',
    },
  ]
}

async function run() {
  const stage = parseStage()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL 环境变量未设置')
  }

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const checks: CheckResult[] = [
      {
        ok: (await tableCount(pool, 'check_in_plan')) === 0,
        label: 'legacy check_in_plan rows = 0',
      },
      {
        ok: (await tableCount(pool, 'check_in_cycle')) === 0,
        label: 'legacy check_in_cycle rows = 0',
      },
      {
        ok: (await settlementTypeCount(pool, 3)) === 0,
        label: 'legacy check-in record settlements removed',
      },
      {
        ok: (await settlementTypeCount(pool, 4)) === 0,
        label: 'legacy check-in streak settlements removed',
      },
      {
        ok: (await tableCount(pool, 'check_in_config')) === 1,
        label: 'new config row count = 1',
      },
      {
        ok: (await activeRoundCount(pool)) === 1,
        label: 'active round row count = 1',
      },
      {
        ok:
          (await totalSettlementCount(pool)) ===
          (await settlementTypeCount(pool, 1)) +
            (await settlementTypeCount(pool, 2)),
        label: 'all remaining settlements are non check-in types',
      },
    ]

    if (stage === 'post-reset') {
      checks.push(
        {
          ok: (await tableCount(pool, 'check_in_record')) === 0,
          label: 'new check_in_record rows = 0 after reset',
        },
        {
          ok: (await tableCount(pool, 'check_in_streak_reward_grant')) === 0,
          label: 'new check_in_streak_reward_grant rows = 0 after reset',
        },
      )
    }

    if (stage === 'post-contract') {
      checks.push(...verifyContractFiles())
    }

    const failed = checks.filter((check) => !check.ok)
    for (const check of checks) {
      console.log(
        `${check.ok ? 'PASS' : 'FAIL'}: ${check.label}${check.details ? ` — ${check.details}` : ''}`,
      )
    }

    if (failed.length > 0) {
      process.exitCode = 1
    }
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
