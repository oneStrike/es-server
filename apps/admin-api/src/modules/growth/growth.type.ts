import type { GrowthRuleTypeEnum } from '@libs/growth/growth'
import type { PageQueryNoOrderInput } from '@libs/platform/types'

/**
 * 成长规则事件聚合查询入参。
 * 面向管理端“按事件聚合查看基础奖励与任务 bonus 关系”的读模型。
 */
export interface QueryGrowthRuleEventPageInput extends PageQueryNoOrderInput {
  type?: GrowthRuleTypeEnum
  isImplemented?: boolean
  hasTask?: boolean
  hasBaseReward?: boolean
}
