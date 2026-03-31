import {
  EventDefinitionConsumerEnum,
  EventEnvelopeGovernanceStatusEnum,
} from '@libs/growth/event-definition'
import { GrowthRuleTypeEnum } from '@libs/growth/growth'

jest.mock('@libs/growth/task', () => ({
  TaskService: class {},
}))

describe('growth event bridge service', () => {
  it('dispatches defined growth events through the unified growth reward entry', async () => {
    const { GrowthEventBridgeService }
      = await import('./growth-event-bridge.service')

    const tryRewardByRule = jest.fn().mockResolvedValue({
      success: true,
      bizKey: 'comment:create:18:user:9',
      ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
      source: 'growth_rule',
      dedupeResult: 'applied',
      ledgerRecordIds: [1, 2],
    })
    const service = new GrowthEventBridgeService(
      {
        getEventDefinition: jest.fn().mockReturnValue({
          key: 'CREATE_COMMENT',
          consumers: [
            EventDefinitionConsumerEnum.GROWTH,
            EventDefinitionConsumerEnum.TASK,
            EventDefinitionConsumerEnum.NOTIFICATION,
          ],
        }),
      } as any,
      { tryRewardByRule } as any,
      {
        consumeEventProgress: jest.fn().mockResolvedValue({
          matchedTaskIds: [11],
          progressedAssignmentIds: [21],
          completedAssignmentIds: [],
          duplicateAssignmentIds: [],
        }),
      } as any,
    )

    await expect(
      service.dispatchDefinedEvent({
        bizKey: 'comment:create:18:user:9',
        source: 'comment',
        targetType: 3,
        eventEnvelope: {
          code: GrowthRuleTypeEnum.CREATE_COMMENT,
          key: 'CREATE_COMMENT',
          subjectType: 'user',
          subjectId: 9,
          targetType: 'comment',
          targetId: 18,
          operatorId: 9,
          occurredAt: new Date('2026-03-31T08:00:00.000Z'),
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          context: {
            commentTargetType: 3,
            commentTargetId: 88,
          },
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        definitionKey: 'CREATE_COMMENT',
        growthHandled: true,
        growthBlockedByGovernance: false,
        taskHandled: true,
        taskEligible: true,
        notificationEligible: true,
        taskResult: {
          matchedTaskIds: [11],
          progressedAssignmentIds: [21],
          completedAssignmentIds: [],
          duplicateAssignmentIds: [],
        },
      }),
    )

    expect(tryRewardByRule).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        ruleType: GrowthRuleTypeEnum.CREATE_COMMENT,
        bizKey: 'comment:create:18:user:9',
        source: 'comment',
        targetType: 3,
        targetId: 18,
        occurredAt: new Date('2026-03-31T08:00:00.000Z'),
        context: expect.objectContaining({
          eventCode: GrowthRuleTypeEnum.CREATE_COMMENT,
          eventKey: 'CREATE_COMMENT',
          eventSubjectId: 9,
          eventTargetId: 18,
          eventOperatorId: 9,
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
          commentTargetType: 3,
          commentTargetId: 88,
          occurredAt: '2026-03-31T08:00:00.000Z',
        }),
      }),
    )
  })

  it('skips growth settlement when the event is blocked by governance', async () => {
    const { GrowthEventBridgeService }
      = await import('./growth-event-bridge.service')

    const tryRewardByRule = jest.fn()
    const service = new GrowthEventBridgeService(
      {
        getEventDefinition: jest.fn().mockReturnValue({
          key: 'CREATE_COMMENT',
          consumers: [
            EventDefinitionConsumerEnum.GROWTH,
            EventDefinitionConsumerEnum.TASK,
          ],
        }),
      } as any,
      { tryRewardByRule } as any,
      { consumeEventProgress: jest.fn() } as any,
    )

    await expect(
      service.dispatchDefinedEvent({
        bizKey: 'comment:create:18:user:9',
        source: 'comment',
        eventEnvelope: {
          code: GrowthRuleTypeEnum.CREATE_COMMENT,
          key: 'CREATE_COMMENT',
          subjectType: 'user',
          subjectId: 9,
          targetType: 'comment',
          targetId: 18,
          occurredAt: new Date('2026-03-31T08:00:00.000Z'),
          governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
        },
      }),
    ).resolves.toEqual({
      definitionKey: 'CREATE_COMMENT',
      consumers: [
        EventDefinitionConsumerEnum.GROWTH,
        EventDefinitionConsumerEnum.TASK,
      ],
      growthHandled: false,
      growthBlockedByGovernance: true,
      taskHandled: false,
      taskEligible: false,
      notificationEligible: false,
    })

    expect(tryRewardByRule).not.toHaveBeenCalled()
  })
})
