/// <reference types="jest" />

import { appUser, growthLedgerRecord, userAssetBalance } from '@db/schema'
import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { ExperienceDeltaDirectionEnum } from './dto/experience-record.dto'
import { UserExperienceService } from './experience.service'

describe('UserExperienceService admin audit contract', () => {
  it('uses global-capable filters, stable ordering, and page-size cap', async () => {
    const { service, drizzle, query } = createExperienceService([
      buildLedgerRecord(),
    ])

    const result = await service.getExperienceRecordPage({
      deltaDirection: ExperienceDeltaDirectionEnum.INCREASE,
      hasRule: true,
      maxDelta: 20,
      minDelta: 1,
      pageIndex: 1,
      pageSize: 500,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      source: 'growth_rule',
      startDate: '2026-06-01',
      endDate: '2026-06-07',
    })

    expect(drizzle.buildPage).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 500 }),
      { maxPageSize: 100 },
    )
    expect(drizzle.buildOrderBy).toHaveBeenCalledWith(
      { createdAt: 'desc', id: 'desc' },
      { table: growthLedgerRecord },
    )
    expect(query.where).toHaveBeenCalledTimes(1)
    expect(result.total).toBe(1)
    expect(result.list[0]).toEqual(
      expect.objectContaining({
        ruleId: null,
        ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
        source: 'growth_rule',
        targetType: null,
        targetId: null,
        context: null,
        remark: null,
        updatedAt: null,
        user: {
          account: 'user007',
          avatarUrl: null,
          id: 7,
          nickname: '经验用户',
        },
      }),
    )
  })

  it('maps nullable record fields to null, not undefined', () => {
    const { service } = createExperienceService([])
    const mapper = service as unknown as {
      toExperienceRecord(record: ReturnType<typeof buildLedgerRecord>): {
        ruleId: number | null
        source: string | null
        targetType: number | null
        targetId: number | null
        context: Record<string, unknown> | null
        remark: string | null
        updatedAt: Date | null
        user: { id: number } | null
      }
    }

    const record = mapper.toExperienceRecord(buildLedgerRecord())

    expect(record.ruleId).toBeNull()
    expect(record.source).toBe('growth_rule')
    expect(record.targetType).toBeNull()
    expect(record.targetId).toBeNull()
    expect(record.context).toBeNull()
    expect(record.remark).toBeNull()
    expect(record.updatedAt).toBeNull()
    expect(record.user).toBeNull()
  })

  it('returns only the user summary on experience record detail', async () => {
    const { db, service } = createExperienceService([])
    db.query.growthLedgerRecord.findFirst.mockResolvedValue({
      ...buildLedgerRecord(),
      context: { operationNote: '补发', privateTrace: 'trace-1' },
      user: {
        id: 7,
        account: 'user007',
        nickname: '经验用户',
        avatarUrl: null,
        phoneNumber: '13800000000',
        emailAddress: 'secret@example.com',
      },
    })

    const detail = await service.getExperienceRecordDetail(1)

    expect(detail.user).toEqual({
      account: 'user007',
      avatarUrl: null,
      id: 7,
      nickname: '经验用户',
    })
    expect(detail.user).not.toHaveProperty('phoneNumber')
    expect(detail.user).not.toHaveProperty('emailAddress')
    expect(detail.diagnosticContext).toEqual({
      operationNote: '补发',
      privateTrace: 'trace-1',
    })
  })
})

function createExperienceService(records: ReturnType<typeof buildLedgerRecord>[]) {
  const query = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue(records),
  }
  const userQuery = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([
      {
        account: 'user007',
        avatarUrl: null,
        id: 7,
        nickname: '经验用户',
      },
    ]),
  }
  const db = {
    select: jest.fn((fields?: Record<string, unknown>) =>
      fields?.account ? userQuery : query,
    ),
    $count: jest.fn().mockResolvedValue(records.length),
    query: {
      appUser: { findFirst: jest.fn() },
      growthLedgerRecord: { findFirst: jest.fn() },
      userAssetBalance: { findFirst: jest.fn() },
    },
  }
  const drizzle = {
    db,
    schema: {
      appUser,
      growthLedgerRecord,
      userAssetBalance,
    },
    buildPage: jest.fn(() => ({
      limit: 100,
      offset: 0,
      pageIndex: 1,
      pageSize: 100,
    })),
    buildOrderBy: jest.fn(() => ({ orderBySql: ['created_desc', 'id_desc'] })),
  }
  const growthLedgerService = {
    sanitizePublicContext: jest.fn(() => null),
  }

  return {
    db,
    drizzle,
    query,
    service: new UserExperienceService(
      growthLedgerService as never,
      drizzle as never,
    ),
  }
}

function buildLedgerRecord() {
  return {
    id: 1,
    userId: 7,
    assetType: GrowthAssetTypeEnum.EXPERIENCE,
    assetKey: '',
    delta: 10,
    beforeValue: 100,
    afterValue: 110,
    bizKey: 'biz-1',
    source: 'growth_rule',
    ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
    ruleId: null,
    targetType: null,
    targetId: null,
    remark: null,
    context: null,
    createdAt: new Date('2026-06-07T00:00:00.000Z'),
    updatedAt: undefined,
  }
}
