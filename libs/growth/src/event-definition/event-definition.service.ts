import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  EventDefinition,
  ListEventDefinitionsInput,
} from './event-definition.type'
import { Injectable } from '@nestjs/common'
import { EVENT_DEFINITION_MAP, EVENT_DEFINITIONS } from './event-definition.map'
import { EventDefinitionImplStatusEnum } from './event-definition.type'

/**
 * 事件定义查询服务。
 * 只提供代码级元数据读取与筛选能力，不承担统一派发、事务编排或消费执行。
 */
@Injectable()
export class EventDefinitionService {
  /**
   * 获取单条事件定义。
   * 返回副本，避免调用方修改共享事实源。
   */
  getEventDefinition(
    code: GrowthRuleTypeEnum | number,
  ): EventDefinition | undefined {
    const definition = EVENT_DEFINITION_MAP[code as GrowthRuleTypeEnum]
    return definition ? this.cloneDefinition(definition) : undefined
  }

  /**
   * 枚举事件定义列表。
   * 统一支持业务域、治理闸门、消费者、实现态与可配置性筛选。
   */
  listEventDefinitions(
    filters: ListEventDefinitionsInput = {},
  ): EventDefinition[] {
    return EVENT_DEFINITIONS.filter((definition) =>
      this.matchesFilters(definition, filters),
    ).map((definition) => this.cloneDefinition(definition))
  }

  /**
   * 枚举已正式接入 producer 的事件定义。
   */
  listImplementedEventDefinitions(): EventDefinition[] {
    return this.listEventDefinitions({ isImplemented: true })
  }

  /**
   * 枚举允许继续用于规则配置的事件定义。
   * 历史兼容编码和人工运维类编码会在这里被排除。
   */
  listRuleConfigurableEventDefinitions(): EventDefinition[] {
    return this.listEventDefinitions({ isRuleConfigurable: true })
  }

  private matchesFilters(
    definition: EventDefinition,
    filters: ListEventDefinitionsInput,
  ) {
    if (filters.domain && definition.domain !== filters.domain) {
      return false
    }
    if (
      filters.governanceGate
      && definition.governanceGate !== filters.governanceGate
    ) {
      return false
    }
    if (
      filters.consumer
      && !definition.consumers.includes(filters.consumer)
    ) {
      return false
    }
    if (filters.implStatus && definition.implStatus !== filters.implStatus) {
      return false
    }
    if (
      filters.isImplemented !== undefined
      && (definition.implStatus === EventDefinitionImplStatusEnum.IMPLEMENTED)
      !== filters.isImplemented
    ) {
      return false
    }
    if (
      filters.isRuleConfigurable !== undefined
      && definition.isRuleConfigurable !== filters.isRuleConfigurable
    ) {
      return false
    }
    return true
  }

  private cloneDefinition(definition: EventDefinition): EventDefinition {
    return {
      ...definition,
      consumers: [...definition.consumers],
    }
  }
}
