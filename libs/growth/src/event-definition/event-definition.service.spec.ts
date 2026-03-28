import { GROWTH_RULE_TYPE_VALUES, GrowthRuleTypeEnum } from '../growth-rule.constant'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionGovernanceGateEnum,
  EventDefinitionImplStatusEnum,
} from './event-definition.type'

describe('event definition service', () => {
  it('covers every numeric growth rule code exactly once', async () => {
    const { EVENT_DEFINITIONS } = await import('./event-definition.map')

    expect(EVENT_DEFINITIONS.map((item) => item.code)).toEqual(
      GROWTH_RULE_TYPE_VALUES,
    )
    expect(new Set(EVENT_DEFINITIONS.map((item) => item.key)).size).toBe(
      GROWTH_RULE_TYPE_VALUES.length,
    )
  })

  it('returns stable metadata for a single event definition', async () => {
    const { EventDefinitionService } = await import('./event-definition.service')

    const service = new EventDefinitionService()
    const definition = service.getEventDefinition(GrowthRuleTypeEnum.CREATE_TOPIC)

    expect(definition).toEqual({
      code: GrowthRuleTypeEnum.CREATE_TOPIC,
      key: 'CREATE_TOPIC',
      label: '发表主题',
      domain: 'forum',
      subjectType: 'user',
      targetType: 'forum_topic',
      governanceGate: 'topic_approval',
      consumers: ['growth', 'task', 'governance'],
      implStatus: 'implemented',
      isRuleConfigurable: true,
    })
  })

  it('filters only implemented event definitions', async () => {
    const { EventDefinitionService } = await import('./event-definition.service')

    const service = new EventDefinitionService()
    const implementedCodes = service
      .listImplementedEventDefinitions()
      .map((item) => item.code)

    expect(implementedCodes).toContain(GrowthRuleTypeEnum.CREATE_TOPIC)
    expect(implementedCodes).toContain(GrowthRuleTypeEnum.REPORT_VALID)
    expect(implementedCodes).not.toContain(GrowthRuleTypeEnum.CREATE_REPLY)
    expect(implementedCodes).not.toContain(GrowthRuleTypeEnum.TOPIC_REPORT)
  })

  it('filters configurable event definitions while excluding legacy and admin-only codes', async () => {
    const { EventDefinitionService } = await import('./event-definition.service')

    const service = new EventDefinitionService()
    const configurableCodes = service
      .listRuleConfigurableEventDefinitions()
      .map((item) => item.code)

    expect(configurableCodes).toContain(GrowthRuleTypeEnum.CREATE_REPLY)
    expect(configurableCodes).toContain(GrowthRuleTypeEnum.REPORT_INVALID)
    expect(configurableCodes).not.toContain(GrowthRuleTypeEnum.ADMIN)
    expect(configurableCodes).not.toContain(GrowthRuleTypeEnum.COMMENT_REPORT)
  })

  it('supports governance and consumer filters together', async () => {
    const { EventDefinitionService } = await import('./event-definition.service')

    const service = new EventDefinitionService()
    const definitions = service.listEventDefinitions({
      governanceGate: EventDefinitionGovernanceGateEnum.REPORT_JUDGEMENT,
      consumer: EventDefinitionConsumerEnum.GOVERNANCE,
      implStatus: EventDefinitionImplStatusEnum.IMPLEMENTED,
    })

    expect(definitions.map((item) => item.code)).toEqual([
      GrowthRuleTypeEnum.REPORT_VALID,
      GrowthRuleTypeEnum.REPORT_INVALID,
    ])
  })

  it('marks moderated comment events with comment approval gate', async () => {
    const { EventDefinitionService } = await import('./event-definition.service')

    const service = new EventDefinitionService()
    const definition = service.getEventDefinition(GrowthRuleTypeEnum.CREATE_COMMENT)

    expect(definition).toBeDefined()
    if (!definition) {
      throw new Error('definition should exist')
    }
    expect(definition.governanceGate).toBe(
      EventDefinitionGovernanceGateEnum.COMMENT_APPROVAL,
    )
    expect(definition.consumers).toContain(EventDefinitionConsumerEnum.GOVERNANCE)
  })
})
