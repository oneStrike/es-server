jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('growth ledger public context', () => {
  it('keeps only whitelisted primitive explanation fields', async () => {
    const { GrowthLedgerService } = await import('./growth-ledger.service')

    const service = new GrowthLedgerService({} as any)

    expect(
      service.sanitizePublicContext({
        taskId: 9,
        assignmentId: 18,
        purchaseId: 3,
        outTradeNo: 'TRADE-001',
        nested: { raw: true },
        debugEnabled: true,
      } as any),
    ).toEqual({
      assignmentId: 18,
      outTradeNo: 'TRADE-001',
      purchaseId: 3,
      taskId: 9,
    })
  })

  it('returns undefined when no public fields remain', async () => {
    const { GrowthLedgerService } = await import('./growth-ledger.service')

    const service = new GrowthLedgerService({} as any)

    expect(
      service.sanitizePublicContext({
        debug: { traceId: 'abc' },
      } as any),
    ).toBeUndefined()
  })

  it('maps a mixed ledger record into the public timeline shape', async () => {
    const { GrowthLedgerService } = await import('./growth-ledger.service')

    const service = new GrowthLedgerService({} as any)

    const record = (service as any).toPublicGrowthLedgerRecord({
      id: 11,
      userId: 9,
      assetType: 2,
      ruleId: 5,
      ruleType: 1,
      targetType: 3,
      targetId: 18,
      delta: 20,
      beforeValue: 100,
      afterValue: 120,
      bizKey: 'task:complete:7:assignment:18:user:9:EXPERIENCE',
      remark: '任务完成奖励（经验）',
      context: {
        assignmentId: 18,
        taskId: 7,
        hidden: { raw: true },
      },
      createdAt: new Date('2026-03-28T13:00:00.000Z'),
    })

    expect(record).toEqual({
      id: 11,
      userId: 9,
      assetType: 2,
      ruleId: 5,
      ruleType: 1,
      targetType: 3,
      targetId: 18,
      delta: 20,
      beforeValue: 100,
      afterValue: 120,
      bizKey: 'task:complete:7:assignment:18:user:9:EXPERIENCE',
      remark: '任务完成奖励（经验）',
      context: {
        assignmentId: 18,
        taskId: 7,
      },
      createdAt: new Date('2026-03-28T13:00:00.000Z'),
    })
  })
})
