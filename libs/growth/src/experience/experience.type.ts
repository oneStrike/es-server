import type { GrowthRuleTypeEnum } from '../growth-rule.constant'

/**
 * 经验规则创建入参。
 * 对应 userExperienceRule 的业务可写字段，experience 必须为正整数。
 */
export interface CreateUserExperienceRuleInput {
  type: GrowthRuleTypeEnum
  experience: number
  dailyLimit: number
  totalLimit: number
  isEnabled: boolean
  remark?: string
}

/**
 * 经验规则更新入参。
 * 包含规则 id 与允许更新的业务字段，dailyLimit / totalLimit 允许为 0。
 */
export interface UpdateUserExperienceRuleInput {
  id: number
  type?: GrowthRuleTypeEnum
  experience?: number
  dailyLimit?: number
  totalLimit?: number
  isEnabled?: boolean
  remark?: string
}

/**
 * 经验规则分页查询条件。
 * 用于管理端规则分页筛选。
 */
export interface QueryUserExperienceRulePageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  type?: GrowthRuleTypeEnum
  isEnabled?: boolean
}

/**
 * 经验记录分页查询条件。
 * 用于按用户与规则筛选经验流水。
 */
export interface QueryUserExperienceRecordPageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  userId: number
  ruleId?: number | null
}

/**
 * 手工发放经验入参。
 * ruleType 表示触发的成长规则类型。
 */
export interface AddUserExperienceInput {
  userId: number
  ruleType: GrowthRuleTypeEnum
  remark?: string
}
