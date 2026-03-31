import { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionEntityTypeEnum,
} from '../event-definition.type'
import {
  canConsumeEventEnvelope,
  canConsumeEventEnvelopeByConsumer,
  createDefinedEventEnvelope,
  createEventEnvelope,
  EventEnvelopeGovernanceStatusEnum,
} from '../event-envelope.type'

describe('event envelope', () => {
  it('creates an envelope from the shared event definition map', () => {
    const occurredAt = new Date('2026-03-28T15:00:00.000Z')

    expect(
      createDefinedEventEnvelope({
        code: GrowthRuleTypeEnum.CREATE_TOPIC,
        subjectId: 9,
        targetId: 18,
        occurredAt,
        governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
        context: {
          sectionId: 3,
        },
      }),
    ).toEqual({
      code: GrowthRuleTypeEnum.CREATE_TOPIC,
      key: 'CREATE_TOPIC',
      subjectType: EventDefinitionEntityTypeEnum.USER,
      subjectId: 9,
      targetType: EventDefinitionEntityTypeEnum.FORUM_TOPIC,
      targetId: 18,
      occurredAt,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
      context: {
        sectionId: 3,
      },
    })
  })

  it('creates a custom envelope for events not yet in the definition map', () => {
    const occurredAt = new Date('2026-03-28T15:30:00.000Z')

    expect(
      createEventEnvelope({
        code: 'task.complete',
        key: 'TASK_COMPLETE',
        subjectType: EventDefinitionEntityTypeEnum.USER,
        subjectId: 7,
        targetType: EventDefinitionEntityTypeEnum.TASK_ASSIGNMENT,
        targetId: 88,
        operatorId: 7,
        occurredAt,
        context: {
          taskId: 15,
          assignmentId: 88,
        },
      }),
    ).toEqual({
      code: 'task.complete',
      key: 'TASK_COMPLETE',
      subjectType: EventDefinitionEntityTypeEnum.USER,
      subjectId: 7,
      targetType: EventDefinitionEntityTypeEnum.TASK_ASSIGNMENT,
      targetId: 88,
      operatorId: 7,
      occurredAt,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      context: {
        taskId: 15,
        assignmentId: 88,
      },
    })
  })

  it('treats none and passed governance states as consumable', () => {
    expect(
      canConsumeEventEnvelope({
        governanceStatus: EventEnvelopeGovernanceStatusEnum.NONE,
      }),
    ).toBe(true)
    expect(
      canConsumeEventEnvelope({
        governanceStatus: EventEnvelopeGovernanceStatusEnum.PASSED,
      }),
    ).toBe(true)
    expect(
      canConsumeEventEnvelope({
        governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
      }),
    ).toBe(false)
    expect(
      canConsumeEventEnvelope({
        governanceStatus: EventEnvelopeGovernanceStatusEnum.REJECTED,
      }),
    ).toBe(false)
  })

  it('only allows approved moderated content into user-facing consumers', () => {
    const pendingCommentEvent = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.CREATE_COMMENT,
      subjectId: 9,
      targetId: 18,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.PENDING,
    })

    expect(
      canConsumeEventEnvelopeByConsumer(
        pendingCommentEvent,
        EventDefinitionConsumerEnum.GROWTH,
      ),
    ).toBe(false)
    expect(
      canConsumeEventEnvelopeByConsumer(
        pendingCommentEvent,
        EventDefinitionConsumerEnum.NOTIFICATION,
      ),
    ).toBe(false)
    expect(
      canConsumeEventEnvelopeByConsumer(
        pendingCommentEvent,
        EventDefinitionConsumerEnum.GOVERNANCE,
      ),
    ).toBe(true)
  })

  it('allows judged report events to enter growth after final verdict', () => {
    const invalidReportEvent = createDefinedEventEnvelope({
      code: GrowthRuleTypeEnum.REPORT_INVALID,
      subjectId: 9,
      targetId: 18,
      governanceStatus: EventEnvelopeGovernanceStatusEnum.REJECTED,
    })

    expect(
      canConsumeEventEnvelopeByConsumer(
        invalidReportEvent,
        EventDefinitionConsumerEnum.GROWTH,
      ),
    ).toBe(true)
    expect(
      canConsumeEventEnvelopeByConsumer(
        invalidReportEvent,
        EventDefinitionConsumerEnum.TASK,
      ),
    ).toBe(true)
  })
})
