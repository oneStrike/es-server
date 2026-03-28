jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('../growth-ledger/growth-ledger.service', () => ({
  GrowthLedgerService: class {},
}))

describe('experience service record explainability', () => {
  it('maps public source fields into experience records', async () => {
    const { UserExperienceService } = await import('./experience.service')

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
