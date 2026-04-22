import type { GrowthRuleTypeEnum } from '../growth-rule.constant'
import type {
  EventDefinition,
  ListEventDefinitionFilters,
} from './event-definition.type'
import { Injectable } from '@nestjs/common'
import { EventDefinitionImplStatusEnum } from './event-definition.constant'
import { EVENT_DEFINITION_MAP, EVENT_DEFINITIONS } from './event-definition.map'

/**
 * 事件定义查询服务。
 * 只提供代码级元数据读取与筛选能力，不承担统一派发、事务编排或消费执行。
 */
@Injectable()
export class EventDefinitionService {
  // 获取单条事件定义，并返回副本避免共享事实源被外部修改。
  getEventDefinition(
    code: GrowthRuleTypeEnum | number,
  ): EventDefinition | undefined {
    const definition = EVENT_DEFINITION_MAP[code as GrowthRuleTypeEnum]
    return definition ? this.cloneDefinition(definition) : undefined
  }

  // 枚举事件定义列表，并统一应用业务域、治理闸门和消费者筛选。
  listEventDefinitions(
    filters: ListEventDefinitionFilters = {},
  ): EventDefinition[] {
    return EVENT_DEFINITIONS.filter((definition) =>
      this.matchesFilters(definition, filters),
    ).map((definition) => this.cloneDefinition(definition))
  }

  // 枚举已正式接入 producer 的事件定义。
  listImplementedEventDefinitions(): EventDefinition[] {
    return this.listEventDefinitions({ isImplemented: true })
  }

  // 枚举允许继续用于规则配置的事件定义，并排除历史兼容编码。
  listRuleConfigurableEventDefinitions(): EventDefinition[] {
    return this.listEventDefinitions({ isRuleConfigurable: true })
  }

  // 判断单条事件定义是否满足当前过滤条件。
  private matchesFilters(
    definition: EventDefinition,
    filters: ListEventDefinitionFilters,
  ) {
    if (filters.domain && definition.domain !== filters.domain) {
      return false
    }
    if (
      filters.governanceGate &&
      definition.governanceGate !== filters.governanceGate
    ) {
      return false
    }
    if (filters.consumer && !definition.consumers.includes(filters.consumer)) {
      return false
    }
    if (filters.implStatus && definition.implStatus !== filters.implStatus) {
      return false
    }
    if (
      filters.isImplemented !== undefined &&
      (definition.implStatus === EventDefinitionImplStatusEnum.IMPLEMENTED) !==
      filters.isImplemented
    ) {
      return false
    }
    if (
      filters.isRuleConfigurable !== undefined &&
      definition.isRuleConfigurable !== filters.isRuleConfigurable
    ) {
      return false
    }
    return true
  }

  // 克隆事件定义，避免调用方修改共享 consumers 数组。
  private cloneDefinition(definition: EventDefinition) {
    return {
      ...definition,
      consumers: [...definition.consumers],
    }
  }
}
