import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { Pool } from 'pg'

type Stage = 'post-reset' | 'post-contract'

interface CheckResult {
  ok: boolean
  label: string
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

function verifyContractFiles(): CheckResult[] {
  const adminController = readFileSync(
    resolve(
      process.cwd(),
      'apps/admin-api/src/modules/check-in/check-in.controller.ts',
    ),
    'utf8',
  )
  const appController = readFileSync(
    resolve(
      process.cwd(),
      'apps/app-api/src/modules/check-in/check-in.controller.ts',
    ),
    'utf8',
  )
  const adminBreakingDoc = readFileSync(
    resolve(process.cwd(), 'docs/breaking-changes/admin-check-in-module.md'),
    'utf8',
  )
  const appBreakingDoc = readFileSync(
    resolve(process.cwd(), 'docs/breaking-changes/app-check-in-module.md'),
    'utf8',
  )

  return [
    {
      ok:
        adminController.includes('daily-streak/detail') &&
        adminController.includes('activity-streak/page') &&
        !adminController.includes('streak-round/detail'),
      label:
        'admin controller switched from streak-round to daily/activity routes',
    },
    {
      ok:
        appController.includes('activity/page') &&
        !appController.includes('roundConfigId') &&
        !appController.includes('streak-round'),
      label:
        'app controller switched to daily summary + activity routes without round contracts',
    },
    {
      ok:
        adminBreakingDoc.includes('按天规则') ||
        adminBreakingDoc.includes('一天一条规则'),
      label: 'admin breaking doc describes relational day-rule streak model',
    },
    {
      ok:
        appBreakingDoc.includes('按天规则') ||
        appBreakingDoc.includes('grant 奖励项快照明细'),
      label:
        'app breaking doc describes relational streak rule and grant item model',
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
        ok: !(await tableExists(pool, 'check_in_streak_round_config')),
        label: 'legacy check_in_streak_round_config removed',
      },
      {
        ok: !(await tableExists(pool, 'check_in_streak_progress')),
        label: 'legacy check_in_streak_progress removed',
      },
      {
        ok: !(await tableExists(pool, 'check_in_streak_reward_grant')),
        label: 'legacy check_in_streak_reward_grant removed',
      },
      {
        ok: await tableExists(pool, 'check_in_daily_streak_config'),
        label: 'check_in_daily_streak_config exists',
      },
      {
        ok: await tableExists(pool, 'check_in_daily_streak_rule'),
        label: 'check_in_daily_streak_rule exists',
      },
      {
        ok: await tableExists(pool, 'check_in_daily_streak_rule_reward_item'),
        label: 'check_in_daily_streak_rule_reward_item exists',
      },
      {
        ok: await tableExists(pool, 'check_in_daily_streak_progress'),
        label: 'check_in_daily_streak_progress exists',
      },
      {
        ok: await tableExists(pool, 'check_in_activity_streak'),
        label: 'check_in_activity_streak exists',
      },
      {
        ok: await tableExists(pool, 'check_in_activity_streak_rule'),
        label: 'check_in_activity_streak_rule exists',
      },
      {
        ok: await tableExists(
          pool,
          'check_in_activity_streak_rule_reward_item',
        ),
        label: 'check_in_activity_streak_rule_reward_item exists',
      },
      {
        ok: await tableExists(pool, 'check_in_activity_streak_progress'),
        label: 'check_in_activity_streak_progress exists',
      },
      {
        ok: await tableExists(pool, 'check_in_streak_grant'),
        label: 'check_in_streak_grant exists',
      },
      {
        ok: await tableExists(pool, 'check_in_streak_grant_reward_item'),
        label: 'check_in_streak_grant_reward_item exists',
      },
    ]

    if (stage === 'post-reset') {
      checks.push(
        {
          ok: (await tableCount(pool, 'check_in_daily_streak_progress')) === 0,
          label: 'daily streak progress row count = 0 after reset',
        },
        {
          ok:
            (await tableCount(pool, 'check_in_activity_streak_progress')) === 0,
          label: 'activity streak progress row count = 0 after reset',
        },
        {
          ok: (await tableCount(pool, 'check_in_streak_grant')) === 0,
          label: 'shared streak grant row count = 0 after reset',
        },
        {
          ok:
            (await tableCount(pool, 'check_in_streak_grant_reward_item')) === 0,
          label: 'grant reward item row count = 0 after reset',
        },
      )
    }

    if (stage === 'post-contract') {
      checks.push(...verifyContractFiles())
    }

    const failed = checks.filter((check) => !check.ok)
    for (const check of checks) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'}: ${check.label}`)
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
