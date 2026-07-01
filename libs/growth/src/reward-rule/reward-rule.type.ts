import type { CreateGrowthRewardRuleDto } from './dto/reward-rule.dto'

/** 奖励规则写入入参，允许部分字段更新。 */
export type GrowthRewardRuleWriteInput = Partial<CreateGrowthRewardRuleDto>
