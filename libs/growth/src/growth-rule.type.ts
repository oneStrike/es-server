import type { GrowthRuleTypeEnum } from './growth-rule.constant'

/** 成长规则英文键名，供事件定义层等元数据模块复用稳定 key。 */
export type GrowthRuleTypeKey = keyof typeof GrowthRuleTypeEnum
