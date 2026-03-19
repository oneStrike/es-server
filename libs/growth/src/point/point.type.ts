import type { GrowthRuleTypeEnum } from '../growth-rule.constant'

/**
 * 积分规则创建入参。
 * 对应 userPointRule 的可写业务字段。
 */
export interface CreateUserPointRuleInput {
  type: GrowthRuleTypeEnum
  points: number
  dailyLimit: number
  totalLimit: number
  isEnabled: boolean
  remark?: string
}

/**
 * 积分规则更新入参。
 * 包含目标规则 id 与完整可写字段。
 */
export interface UpdateUserPointRuleInput extends CreateUserPointRuleInput {
  id: number
}

/**
 * 积分规则分页查询条件。
 * 仅包含管理端分页与筛选字段。
 */
export interface QueryUserPointRulePageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  type?: GrowthRuleTypeEnum
  isEnabled?: boolean
}

/**
 * 用户积分记录分页查询条件。
 * 用于按用户及可选规则/目标维度筛选积分流水。
 */
export interface QueryUserPointRecordPageInput {
  pageIndex?: number
  pageSize?: number
  orderBy?: string
  userId: number
  ruleId?: number
  targetType?: number
  targetId?: number
}

/**
 * 手工发放积分入参。
 * ruleType 表示触发的成长规则类型。
 */
export interface AddUserPointsInput {
  userId: number
  ruleType: GrowthRuleTypeEnum
  remark?: string
}

/**
 * 手工扣减积分入参。
 * 可附带目标信息与兑换记录标识。
 */
export interface ConsumeUserPointsInput {
  userId: number
  points: number
  targetType?: number
  targetId?: number
  exchangeId?: number
  remark?: string
}
