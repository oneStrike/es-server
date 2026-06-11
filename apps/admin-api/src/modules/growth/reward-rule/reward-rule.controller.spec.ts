/// <reference types="jest" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('RewardRuleController archive route contract', () => {
  const source = readFileSync(
    resolve('apps/admin-api/src/modules/growth/reward-rule/reward-rule.controller.ts'),
    'utf8',
  )

  it('exposes an audited archive route and removes the old delete route', () => {
    expect(source).toContain("@Post('archive')")
    expect(source).toContain("summary: '归档成长奖励规则'")
    expect(source).toContain('ApiAuditDoc')
    expect(source).toContain('archiveRewardRule(body, adminUserId)')
    expect(source).not.toContain("@Post('delete')")
    expect(source).not.toContain('deleteRewardRule(body.id)')
    expect(source).not.toContain('兼容旧删除路由')
  })
})
