/// <reference types="jest" />
import verifyHelper from '../../../../scripts/check-in-destructive-verify.helper'

describe('check-in-destructive-verify contract checks', () => {
  it('requires concrete unified routes and schema artifacts instead of weak substrings', () => {
    const weakSummaryOnly = verifyHelper.buildContractCheckResults({
      adminController: `
        @Get('streak/detail')
        @Get('streak/history/page')
        @Post('streak/publish')
        @Post('streak/terminate')
      `,
      appController: `
        const summary = 'not a route'
      `,
      adminBreakingDoc:
        '统一连续签到配置 一天一条规则记录 下线路由 activity-streak/*',
      appBreakingDoc:
        '只读取当前生效配置 一天一条规则记录 已下线 activity/detail',
      schemaIndex: '',
      relationsFile: '',
      migrationFile: '',
    })

    expect(weakSummaryOnly.every((item) => item.ok)).toBe(false)
    expect(
      weakSummaryOnly.find(
        (item) => item.label === 'app controller exposes unified runtime routes',
      )?.ok,
    ).toBe(false)
    expect(
      weakSummaryOnly.find(
        (item) => item.label === 'schema index exports unified streak tables',
      )?.ok,
    ).toBe(false)
  })

  it('passes when controllers, docs, schema index, relations, and migration all match unified model', () => {
    const checks = verifyHelper.buildContractCheckResults({
      adminController: `
        @Get('streak/detail')
        @Get('streak/history/page')
        @Get('streak/history/detail')
        @Post('streak/publish')
        @Post('streak/terminate')
      `,
      appController: `
        @Get('summary')
        @Get('calendar')
        @Get('my/page')
        @Get('leaderboard/page')
        @Post('sign')
        @Post('makeup')
      `,
      adminBreakingDoc:
        '统一连续签到配置 一天一条规则记录 下线路由 activity-streak/*',
      appBreakingDoc:
        '只读取当前生效配置 一天一条规则记录 已下线 activity/detail',
      schemaIndex: `
        export * from './app/check-in-streak-config'
        export * from './app/check-in-streak-rule'
        export * from './app/check-in-streak-rule-reward-item'
        export * from './app/check-in-streak-progress'
      `,
      relationsFile: `
        checkInStreakConfig:
        checkInStreakRule:
        checkInStreakProgress:
        checkInStreakGrant:
      `,
      migrationFile: `
        DROP TABLE IF EXISTS "check_in_daily_streak_config";
        DROP TABLE IF EXISTS "check_in_activity_streak";
        CREATE TABLE "check_in_streak_config" ();
        CREATE TABLE "check_in_streak_rule" ();
        CREATE TABLE "check_in_streak_progress" ();
        CREATE TABLE "check_in_streak_grant" ();
      `,
    })

    expect(checks.filter((item) => !item.ok)).toEqual([])
  })
})
