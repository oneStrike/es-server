/// <reference types="jest" />

import { EventDefinitionImplStatusEnum } from './event-definition.constant'
import { EventDefinitionService } from './event-definition.service'

describe('EventDefinitionService growth reward contract', () => {
  const service = new EventDefinitionService()

  it('keeps coverage broad while configurable reward events stay implemented only', () => {
    const coverage = service.listGrowthEventCoverageDefinitions()
    const configurable = service.listRuleConfigurableEventDefinitions()

    expect(
      coverage.some(
        (item) => item.implStatus === EventDefinitionImplStatusEnum.DECLARED,
      ),
    ).toBe(true)
    expect(configurable.length).toBeGreaterThan(0)
    expect(
      configurable.every(
        (item) =>
          item.implStatus === EventDefinitionImplStatusEnum.IMPLEMENTED &&
          item.isRuleConfigurable,
      ),
    ).toBe(true)
    expect(
      configurable.some(
        (item) => item.implStatus === EventDefinitionImplStatusEnum.DECLARED,
      ),
    ).toBe(false)
  })

  it('explains disabled reward rule events instead of silently exposing them', () => {
    expect(service.getRuleConfigDisabledReason(1)).toBeNull()
    expect(service.getRuleConfigDisabledReason(2)).toBe(
      '事件尚未正式接入 producer',
    )
    expect(service.getRuleConfigDisabledReason(7)).toBe(
      '事件不支持配置基础奖励规则',
    )
    expect(service.getRuleConfigDisabledReason(999999)).toBe('事件定义不存在')
  })
})
