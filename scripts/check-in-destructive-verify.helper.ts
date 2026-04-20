export interface CheckResult {
  ok: boolean
  label: string
}

export interface ContractArtifacts {
  adminController: string
  appController: string
  adminBreakingDoc: string
  appBreakingDoc: string
  schemaIndex: string
  relationsFile: string
  migrationFile: string
}

export function buildContractCheckResults(
  artifacts: ContractArtifacts,
): CheckResult[] {
  const {
    adminController,
    appController,
    adminBreakingDoc,
    appBreakingDoc,
    schemaIndex,
    relationsFile,
    migrationFile,
  } = artifacts

  return [
    {
      ok:
        adminController.includes("@Get('streak/detail')") &&
        adminController.includes("@Get('streak/history/page')") &&
        adminController.includes("@Get('streak/history/detail')") &&
        adminController.includes("@Post('streak/publish')") &&
        adminController.includes("@Post('streak/terminate')") &&
        !adminController.includes("daily-streak/") &&
        !adminController.includes("activity-streak/") &&
        !adminController.includes("streak-round/"),
      label: 'admin controller exposes unified streak routes',
    },
    {
      ok:
        appController.includes("@Get('summary')") &&
        appController.includes("@Get('calendar')") &&
        appController.includes("@Get('my/page')") &&
        appController.includes("@Get('leaderboard/page')") &&
        appController.includes("@Post('sign')") &&
        appController.includes("@Post('makeup')") &&
        !appController.includes("@Get('activity/page')") &&
        !appController.includes("@Get('activity/detail')"),
      label: 'app controller exposes unified runtime routes',
    },
    {
      ok:
        adminBreakingDoc.includes('统一连续签到配置') &&
        adminBreakingDoc.includes('一天一条规则记录') &&
        adminBreakingDoc.includes('activity-streak/*'),
      label: 'admin breaking doc describes unified streak config model',
    },
    {
      ok:
        appBreakingDoc.includes('只读取当前生效配置') &&
        appBreakingDoc.includes('一天一条规则记录') &&
        appBreakingDoc.includes('activity/detail'),
      label: 'app breaking doc describes unified streak runtime model',
    },
    {
      ok:
        schemaIndex.includes("export * from './app/check-in-streak-config'") &&
        schemaIndex.includes("export * from './app/check-in-streak-rule'") &&
        schemaIndex.includes(
          "export * from './app/check-in-streak-rule-reward-item'",
        ) &&
        schemaIndex.includes("export * from './app/check-in-streak-progress'") &&
        !schemaIndex.includes("check-in-daily-streak") &&
        !schemaIndex.includes("check-in-activity-streak"),
      label: 'schema index exports unified streak tables',
    },
    {
      ok:
        relationsFile.includes('checkInStreakConfig:') &&
        relationsFile.includes('checkInStreakRule:') &&
        relationsFile.includes('checkInStreakProgress:') &&
        relationsFile.includes('checkInStreakGrant:') &&
        !relationsFile.includes('checkInDailyStreakConfig:') &&
        !relationsFile.includes('checkInActivityStreak:'),
      label: 'relations define unified streak tables',
    },
    {
      ok:
        migrationFile.includes('DROP TABLE IF EXISTS "check_in_daily_streak_config"') &&
        migrationFile.includes('DROP TABLE IF EXISTS "check_in_activity_streak"') &&
        migrationFile.includes('CREATE TABLE "check_in_streak_config"') &&
        migrationFile.includes('CREATE TABLE "check_in_streak_rule"') &&
        migrationFile.includes('CREATE TABLE "check_in_streak_progress"') &&
        migrationFile.includes('CREATE TABLE "check_in_streak_grant"'),
      label: 'migration creates unified streak tables and removes split tables',
    },
  ]
}

export default {
  buildContractCheckResults,
}
