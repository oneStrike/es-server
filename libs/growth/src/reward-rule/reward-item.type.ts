import type { GrowthRewardRuleAssetTypeEnum } from './reward-rule.constant'

/**
 * 统一奖励项合同。
 *
 * `assetType + assetKey + amount` 与 `growth_reward_rule` 的资产语义保持一致，
 * 供 task、check-in 等多奖励场景复用。
 */
export interface GrowthRewardItem {
  assetType: GrowthRewardRuleAssetTypeEnum
  assetKey?: string
  amount: number
}

/** 稳定领域类型 `GrowthRewardItems`。仅供内部领域/服务链路复用，避免重复定义。 */
export type GrowthRewardItems = GrowthRewardItem[]
