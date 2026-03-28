/**
 * 事件定义层的统一事实源说明。
 * DTO 与文档应复用该说明，避免继续复制手写长枚举列表。
 */
export const EVENT_DEFINITION_FACT_SOURCE_DESCRIPTION =
  '完整编码、语义、治理态与实现状态以 EventDefinitionMap / EventDefinitionService 为唯一事实源。'

/**
 * 规则配置类 DTO 的成长规则类型说明。
 * 当前用于积分规则、经验规则等配置入口。
 */
export const GROWTH_RULE_TYPE_RULE_DTO_DESCRIPTION =
  `成长规则类型。${EVENT_DEFINITION_FACT_SOURCE_DESCRIPTION} 新增或调整规则配置时，建议优先使用 isRuleConfigurable=true 的事件编码。`

/**
 * 账本与记录类 DTO 的成长规则类型说明。
 * 当前用于积分、经验与混合成长流水展示。
 */
export const GROWTH_RULE_TYPE_RECORD_DTO_DESCRIPTION =
  `成长规则类型。${EVENT_DEFINITION_FACT_SOURCE_DESCRIPTION} 账本与历史记录展示可能包含 implemented / declared / legacy_compat 三类事件编码。`

/**
 * 管理端人工操作类 DTO 的成长规则类型说明。
 * 当前用于人工补发积分、经验等后台入口。
 */
export const GROWTH_RULE_TYPE_ADMIN_ACTION_DTO_DESCRIPTION =
  `成长规则类型。${EVENT_DEFINITION_FACT_SOURCE_DESCRIPTION} 管理端人工补发通常建议使用 ADMIN；若补录治理结果，请使用当前正式事件编码，而不要继续使用历史兼容 *_REPORT。`
