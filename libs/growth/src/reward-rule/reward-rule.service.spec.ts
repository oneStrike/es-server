/// <reference types="jest" />

import { growthRewardRule } from '@db/schema'
import { EventDefinitionService } from '@libs/growth/event-definition/event-definition.service'
import { BusinessException } from '@libs/platform/exceptions'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { GrowthRewardRuleAssetTypeEnum } from './reward-rule.constant'
import { GrowthRewardRuleService } from './reward-rule.service'

describe('GrowthRewardRuleService archive and event guard contract', () => {
  it('rejects experience rules for unimplemented events before writing', async () => {
    const { service, db } = createServiceWithRule()

    await expect(
      service.createRewardRule({
        type: GrowthRuleTypeEnum.CREATE_REPLY,
        assetType: GrowthRewardRuleAssetTypeEnum.EXPERIENCE,
        assetKey: '',
        delta: 10,
        dailyLimit: 0,
        totalLimit: 0,
        isEnabled: true,
      }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('archives active rules instead of physically deleting them', async () => {
    const { service, db, updateSet, updateWhere } = createServiceWithRule({
      id: 11,
      type: GrowthRuleTypeEnum.CREATE_TOPIC,
      assetType: GrowthRewardRuleAssetTypeEnum.EXPERIENCE,
      assetKey: '',
      delta: 10,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
      remark: null,
      archivedAt: null,
      archivedBy: null,
      archiveReasonCode: null,
      archiveReason: null,
      createdAt: new Date('2026-06-07T00:00:00.000Z'),
      updatedAt: new Date('2026-06-07T00:00:00.000Z'),
    })

    await expect(
      service.archiveRewardRule(
        { id: 11, archiveReason: '运营下线旧规则' },
        99,
      ),
    ).resolves.toBe(true)

    expect('delete' in db).toBe(false)
    expect(db.update).toHaveBeenCalledWith(growthRewardRule)
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isEnabled: false,
        archivedBy: 99,
        archiveReasonCode: 'OPERATOR_ARCHIVE',
        archiveReason: '运营下线旧规则',
      }),
    )
    const updatePayload = updateSet.mock.calls[0]?.[0]
    expect(updatePayload?.archivedAt).toBeInstanceOf(Date)
    expect(updateWhere).toHaveBeenCalledTimes(1)
  })

  it('blocks edits to archived rules', async () => {
    const { service, db } = createServiceWithRule({
      id: 12,
      type: GrowthRuleTypeEnum.CREATE_TOPIC,
      assetType: GrowthRewardRuleAssetTypeEnum.EXPERIENCE,
      assetKey: '',
      delta: 10,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: false,
      remark: null,
      archivedAt: new Date('2026-06-07T01:00:00.000Z'),
      archivedBy: 99,
      archiveReasonCode: 'OPERATOR_ARCHIVE',
      archiveReason: '运营下线旧规则',
      createdAt: new Date('2026-06-07T00:00:00.000Z'),
      updatedAt: new Date('2026-06-07T01:00:00.000Z'),
    })

    await expect(
      service.updateRewardRule({ id: 12, delta: 20 }),
    ).rejects.toBeInstanceOf(BusinessException)
    expect(db.update).not.toHaveBeenCalled()
  })
})

function createServiceWithRule(rule?: typeof growthRewardRule.$inferSelect) {
  const selectLimit = jest.fn().mockResolvedValue(rule ? [rule] : [])
  const selectWhere = jest.fn(() => ({ limit: selectLimit }))
  const selectFrom = jest.fn(() => ({ where: selectWhere }))
  const select = jest.fn(() => ({ from: selectFrom }))

  const updateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
  const updateSet = jest.fn((_: Record<string, unknown>) => ({
    where: updateWhere,
  }))
  const update = jest.fn(() => ({ set: updateSet }))
  const insert = jest.fn()

  const db = {
    insert,
    select,
    update,
  }
  const drizzle = {
    db,
    schema: { growthRewardRule },
    buildPage: jest.fn(() => ({
      limit: 15,
      offset: 0,
      pageIndex: 1,
      pageSize: 15,
    })),
    buildOrderBy: jest.fn(() => ({ orderBySql: [] })),
    withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  }

  return {
    db,
    service: new GrowthRewardRuleService(
      drizzle as never,
      new EventDefinitionService(),
    ),
    updateSet,
    updateWhere,
  }
}
