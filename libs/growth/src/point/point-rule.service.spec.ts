jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('point rule service validation', () => {
  it('rejects non-positive point rewards before insert', async () => {
    const { UserPointRuleService } = await import('./point-rule.service')
    const { GrowthRuleTypeEnum } = await import('../growth-rule.constant')

    const insert = jest.fn()
    const service = new UserPointRuleService(
      {
        db: { insert },
        schema: { userPointRule: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
    )

    await expect(
      service.createPointRule({
        type: GrowthRuleTypeEnum.CREATE_TOPIC,
        points: 0,
        dailyLimit: 0,
        totalLimit: 0,
        isEnabled: true,
      }),
    ).rejects.toThrow('积分规则值必须是大于0的整数')

    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects negative limits before update', async () => {
    const { UserPointRuleService } = await import('./point-rule.service')
    const { GrowthRuleTypeEnum } = await import('../growth-rule.constant')

    const update = jest.fn()
    const service = new UserPointRuleService(
      {
        db: { update },
        schema: { userPointRule: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
    )

    await expect(
      service.updatePointRule({
        id: 1,
        type: GrowthRuleTypeEnum.CREATE_TOPIC,
        points: 5,
        dailyLimit: -1,
        totalLimit: 0,
        isEnabled: true,
      }),
    ).rejects.toThrow('积分规则每日上限必须是大于等于0的整数')

    expect(update).not.toHaveBeenCalled()
  })
})
