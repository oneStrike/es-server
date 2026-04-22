/**
 * 奖励规则资产类型直接复用统一成长资产枚举。
 * 避免奖励规则、账本、余额与通知链路各自维护一套重复数值定义。
 */
export { GrowthAssetTypeEnum as GrowthRewardRuleAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
