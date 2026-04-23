import type {
  EventDefinitionEntityTypeEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import type {
  GrowthRuleTypeEnum,
  GrowthRuleTypeKey,
} from '@libs/growth/growth-rule.constant'

/**
 * 任务模板可配置的过滤字段定义。
 *
 * 它描述运营侧表单可见的字段，而不是底层直接写入的原始 JSON 结构。
 */
export interface TaskEventTemplateFilterField {
  /** 表单字段稳定键。 */
  key: string
  /** 运营侧可见名称。 */
  label: string
  /** 字段值类型。 */
  valueType: 'number' | 'string' | 'boolean'
  /** 字段业务说明。 */
  description: string
}

/**
 * 任务模板内部使用的唯一维度定义。
 *
 * 仅供执行层从命中事件里提取稳定维度值，不直接暴露给后台表单合同。
 */
export interface TaskEventTemplateUniqueDimension {
  /** 唯一维度稳定键。 */
  key: string
  /** 唯一维度值来源。 */
  source: 'target_id' | 'context_key'
  /** 当来源为上下文字段时使用的 context key。 */
  contextKey?: string
}

/**
 * 新任务模型中的事件模板元数据。
 *
 * 它是 task 侧对 event-definition 的受控投影，用于后台配置和执行层提取合同。
 */
export interface TaskEventTemplate {
  /** 模板稳定键。 */
  templateKey: GrowthRuleTypeKey
  /** 对应事件编码。 */
  eventCode: GrowthRuleTypeEnum
  /** 模板名称。 */
  label: string
  /** 底层事件实现状态。 */
  implStatus: EventDefinitionImplStatusEnum
  /** 当前是否允许正式创建为生效任务。 */
  isSelectable: boolean
  /** 命中的目标实体类型。 */
  targetEntityType: EventDefinitionEntityTypeEnum
  /** 当前模板是否支持按不同对象累计。 */
  supportsUniqueCounting: boolean
  /** 模板内部使用的默认唯一维度。 */
  uniqueDimension?: TaskEventTemplateUniqueDimension
  /** 可选过滤字段列表。 */
  availableFilterFields: TaskEventTemplateFilterField[]
  /** 需要在后台显式展示的提醒文案。 */
  warningHints: string[]
}
