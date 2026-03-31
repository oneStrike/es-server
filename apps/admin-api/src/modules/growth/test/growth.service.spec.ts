import {
  EventDefinitionConsumerEnum,
  EventDefinitionDomainEnum,
  EventDefinitionGovernanceGateEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('@libs/growth/task', () => ({
  TaskObjectiveTypeEnum: {
    MANUAL: 1,
    EVENT_COUNT: 2,
  },
  TaskStatusEnum: {
    DRAFT: 0,
    PUBLISHED: 1,
    OFFLINE: 2,
  },
  TaskTypeEnum: {
    ONBOARDING: 1,
    DAILY: 2,
    CAMPAIGN: 4,
  },
  normalizeTaskType: (value: number | null | undefined) => {
    if (value === 3) {
      return 2
    }
    if (value === 5) {
      return 4
    }
    return value ?? 1
  },
}))

describe('growth service', () => {
  it('aggregates point rules, experience rules and event tasks by rule type', async () => {
    const { GrowthService } = await import('../growth.service')

    const pointWhere = jest.fn().mockResolvedValue([
      {
        id: 11,
        type: GrowthRuleTypeEnum.CREATE_TOPIC,
        points: 5,
        dailyLimit: 1,
        totalLimit: 0,
        isEnabled: true,
        remark: '发帖积分',
      },
    ])
    const experienceWhere = jest.fn().mockResolvedValue([
      {
        id: 22,
        type: GrowthRuleTypeEnum.CREATE_TOPIC,
        experience: 3,
        dailyLimit: 1,
        totalLimit: 0,
        isEnabled: true,
        remark: '发帖经验',
      },
    ])
    const taskWhere = jest.fn().mockResolvedValue([
      {
        id: 101,
          type: 3,
          status: 1,
          isEnabled: true,
          eventCode: GrowthRuleTypeEnum.CREATE_TOPIC,
        },
    ])

    const select = jest
      .fn()
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({ where: pointWhere })),
      }))
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({ where: experienceWhere })),
      }))
      .mockImplementationOnce(() => ({
        from: jest.fn(() => ({ where: taskWhere })),
      }))

    const service = new GrowthService(
      {
        db: { select },
        buildPage: jest.fn(() => ({
          pageIndex: 1,
          pageSize: 20,
          offset: 0,
          limit: 20,
        })),
        schema: {
          userPointRule: { type: 'point.type' },
          userExperienceRule: { type: 'experience.type' },
          task: {
            id: 'task.id',
            type: 'task.type',
            status: 'task.status',
            isEnabled: 'task.isEnabled',
            eventCode: 'task.eventCode',
            objectiveType: 'task.objectiveType',
            deletedAt: 'task.deletedAt',
          },
        },
      } as any,
      {
        listRuleConfigurableEventDefinitions: jest.fn().mockReturnValue([
          {
            code: GrowthRuleTypeEnum.CREATE_TOPIC,
            key: 'CREATE_TOPIC',
            name: '发表主题',
            domain: EventDefinitionDomainEnum.FORUM,
            governanceGate: EventDefinitionGovernanceGateEnum.NONE,
            implStatus: EventDefinitionImplStatusEnum.IMPLEMENTED,
            consumers: [
              EventDefinitionConsumerEnum.GROWTH,
              EventDefinitionConsumerEnum.TASK,
            ],
          },
          {
            code: GrowthRuleTypeEnum.CREATE_REPLY,
            key: 'CREATE_REPLY',
            name: '发表回复',
            domain: EventDefinitionDomainEnum.FORUM,
            governanceGate: EventDefinitionGovernanceGateEnum.NONE,
            implStatus: EventDefinitionImplStatusEnum.DECLARED,
            consumers: [EventDefinitionConsumerEnum.GROWTH],
          },
        ]),
      } as any,
    )

    const result = await service.getGrowthRuleEventPage({
      pageIndex: 1,
      pageSize: 20,
    })

    expect(result.total).toBe(2)
    expect(result.list[0]).toMatchObject({
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      hasBaseReward: true,
      hasTask: true,
      supportsTaskObjective: true,
      pointRule: {
        exists: true,
        amount: 5,
      },
      experienceRule: {
        exists: true,
        amount: 3,
      },
      taskBinding: {
        exists: true,
        relatedTaskCount: 1,
        publishedTaskCount: 1,
        enabledTaskCount: 1,
        sceneTypes: [2],
        taskIds: [101],
      },
    })
    expect(result.list[1]).toMatchObject({
      ruleType: GrowthRuleTypeEnum.CREATE_REPLY,
      hasBaseReward: false,
      hasTask: false,
      supportsTaskObjective: false,
      taskBinding: {
        exists: false,
        relatedTaskCount: 0,
      },
    })
  })
})
