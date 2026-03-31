jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('../../growth-ledger/growth-ledger.service', () => ({
  GrowthLedgerService: class {},
}))

describe('experience service rule validation', () => {
  it('rejects invalid experience rule type before insert', async () => {
    const { UserExperienceService } = await import('../experience.service')

    const insert = jest.fn()
    const service = new UserExperienceService(
      {} as any,
      {
        db: { insert },
        schema: { userExperienceRule: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
    )

    await expect(
      service.createExperienceRule({
        type: 9999 as any,
        experience: 5,
        dailyLimit: 0,
        totalLimit: 0,
        isEnabled: true,
      }),
    ).rejects.toThrow('经验规则类型无效')

    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects invalid experience rule values before update', async () => {
    const { UserExperienceService } = await import('../experience.service')

    const update = jest.fn()
    const service = new UserExperienceService(
      {} as any,
      {
        db: { update },
        schema: { userExperienceRule: {} },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
    )

    await expect(
      service.updateExperienceRule({
        id: 1,
        experience: 0,
      }),
    ).rejects.toThrow('经验规则值必须是大于0的整数')

    await expect(
      service.updateExperienceRule({
        id: 1,
        dailyLimit: -1,
      }),
    ).rejects.toThrow('经验规则每日上限必须是大于等于0的整数')

    expect(update).not.toHaveBeenCalled()
  })
})

describe('experience service record explainability', () => {
  it('maps public source fields into experience records', async () => {
    const { UserExperienceService } = await import('../experience.service')

    const sanitizePublicContext = jest.fn().mockReturnValue({
      assignmentId: 88,
      taskId: 15,
    })
    const service = new UserExperienceService(
      { sanitizePublicContext } as any,
      {} as any,
    )

    const record = (service as any).toExperienceRecord({
      id: 6,
      userId: 3,
      ruleId: 2,
      ruleType: 1,
      targetType: 9,
      targetId: 15,
      source: 'task_bonus',
      delta: 20,
      beforeValue: 100,
      afterValue: 120,
      bizKey: 'task:complete:15:assignment:88:user:3:EXPERIENCE',
      remark: '任务完成奖励（经验）',
      context: {
        assignmentId: 88,
        taskId: 15,
        internal: 'hidden',
      },
      createdAt: new Date('2026-03-28T10:00:00.000Z'),
      updatedAt: new Date('2026-03-28T10:00:00.000Z'),
    })

    expect(record).toEqual(
      expect.objectContaining({
        ruleType: 1,
        targetType: 9,
        targetId: 15,
        source: 'task_bonus',
        bizKey: 'task:complete:15:assignment:88:user:3:EXPERIENCE',
        context: {
          assignmentId: 88,
          taskId: 15,
        },
        experience: 20,
        beforeExperience: 100,
        afterExperience: 120,
      }),
    )
    expect(sanitizePublicContext).toHaveBeenCalledWith({
      assignmentId: 88,
      taskId: 15,
      internal: 'hidden',
    })
  })
})
