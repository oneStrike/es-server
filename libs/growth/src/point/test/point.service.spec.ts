jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('../point-rule.service', () => ({
  UserPointRuleService: class {},
}))

jest.mock('../../growth-ledger/growth-ledger.service', () => ({
  GrowthLedgerService: class {},
}))

describe('point service record explainability', () => {
  it('maps public source fields into point records', async () => {
    const { UserPointService } = await import('../point.service')

    const sanitizePublicContext = jest.fn().mockReturnValue({
      exchangeId: 7,
      taskId: 12,
    })
    const service = new UserPointService(
      {} as any,
      {} as any,
      { sanitizePublicContext } as any,
    )

    const record = (service as any).toPointRecord({
      id: 1,
      userId: 9,
      ruleId: 5,
      ruleType: 302,
      targetType: 3,
      targetId: 18,
      source: 'purchase',
      delta: -20,
      beforeValue: 120,
      afterValue: 100,
      bizKey: 'purchase:1:consume',
      remark: '购买积分扣减',
      context: {
        exchangeId: 7,
        taskId: 12,
        debug: { hidden: true },
      },
      createdAt: new Date('2026-03-28T09:00:00.000Z'),
    })

    expect(record).toEqual(
      expect.objectContaining({
        ruleType: 302,
        targetType: 3,
        targetId: 18,
        source: 'purchase',
        bizKey: 'purchase:1:consume',
        context: {
          exchangeId: 7,
          taskId: 12,
        },
        points: -20,
        beforePoints: 120,
        afterPoints: 100,
      }),
    )
    expect(sanitizePublicContext).toHaveBeenCalledWith({
      exchangeId: 7,
      taskId: 12,
      debug: { hidden: true },
    })
  })
})
