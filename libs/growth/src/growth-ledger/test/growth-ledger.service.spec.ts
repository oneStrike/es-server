jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('growth ledger public context', () => {
  it('rejects non-positive rule values before touching user balance', async () => {
    const { GrowthLedgerService } = await import('../growth-ledger.service')
    const {
      GrowthAssetTypeEnum,
      GrowthLedgerFailReasonEnum,
    } = await import('../growth-ledger.constant')
    const { GrowthRuleTypeEnum } = await import('../../growth-rule.constant')

    const service = new GrowthLedgerService({} as any)

    jest.spyOn(service as any, 'findRuleByType').mockResolvedValue({
      id: 1,
      points: -5,
      dailyLimit: 0,
      totalLimit: 0,
      isEnabled: true,
    })
    const writeAuditLog = jest
      .spyOn(service as any, 'writeAuditLog')
      .mockResolvedValue(undefined)
    const incrementUserBalance = jest
      .spyOn(service as any, 'incrementUserBalance')
      .mockResolvedValue(0)
    const createLedgerGate = jest
      .spyOn(service as any, 'createLedgerGate')
      .mockResolvedValue({ duplicated: false, recordId: 99 })

    const result = await service.applyByRule({} as any, {
      userId: 9,
      assetType: GrowthAssetTypeEnum.POINTS,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      bizKey: 'point:rule:test',
    })

    expect(result).toEqual({
      success: false,
      reason: GrowthLedgerFailReasonEnum.RULE_ZERO,
    })
    expect(writeAuditLog).toHaveBeenCalled()
    expect(createLedgerGate).not.toHaveBeenCalled()
    expect(incrementUserBalance).not.toHaveBeenCalled()
  })

  it('keeps only whitelisted primitive explanation fields', async () => {
    const { GrowthLedgerService } = await import('../growth-ledger.service')

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
    const { GrowthLedgerService } = await import('../growth-ledger.service')

    const service = new GrowthLedgerService({} as any)

    expect(
      service.sanitizePublicContext({
        debug: { traceId: 'abc' },
      } as any),
    ).toBeUndefined()
  })

  it('maps a mixed ledger record into the public timeline shape', async () => {
    const { GrowthLedgerService } = await import('../growth-ledger.service')

    const service = new GrowthLedgerService({} as any)

    const record = (service as any).toPublicGrowthLedgerRecord({
      id: 11,
      userId: 9,
      assetType: 2,
      source: 'task_bonus',
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
      source: 'task_bonus',
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
