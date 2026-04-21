import type { GrowthRewardItems } from '../reward-rule/reward-item.type'
import type {
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
  CheckInPatternRewardRuleTypeEnum,
  CheckInRewardSourceTypeEnum,
  CheckInStreakConfigStatusEnum,
  CheckInStreakPublishStrategyEnum,
} from './check-in.constant'

/** 具体日期奖励规则。 */
export interface CheckInDateRewardRuleView {
  rewardDate: string
  rewardItems: GrowthRewardItems
}

/** 周期模式奖励规则。 */
export interface CheckInPatternRewardRuleView {
  patternType: CheckInPatternRewardRuleTypeEnum
  weekday: number | null
  monthDay: number | null
  rewardItems: GrowthRewardItems
}

/** 连续奖励规则。 */
export interface CheckInStreakRewardRuleView {
  ruleCode: string
  streakDays: number
  rewardItems: GrowthRewardItems
  repeatable: boolean
  status: CheckInStreakConfigStatusEnum
}

/** 全局签到奖励定义。 */
export interface CheckInRewardDefinition {
  baseRewardItems: GrowthRewardItems | null
  dateRewardRules: CheckInDateRewardRuleView[]
  patternRewardRules: CheckInPatternRewardRuleView[]
}

/** 连续签到记录版本定义。 */
export interface CheckInStreakRuleDefinition {
  ruleCode: string
  streakDays: number
  version: number
  status: CheckInStreakConfigStatusEnum
  publishStrategy: CheckInStreakPublishStrategyEnum
  rewardItems: GrowthRewardItems
  repeatable: boolean
  effectiveFrom: Date
  effectiveTo: Date | null
}

/** 当前补签周期窗口。 */
export interface CheckInMakeupWindowView {
  periodType: CheckInMakeupPeriodTypeEnum
  periodKey: string
  periodStartDate: string
  periodEndDate: string
}

/** 当前补签账户读模型。 */
export interface CheckInMakeupAccountView extends CheckInMakeupWindowView {
  periodicGranted: number
  periodicUsed: number
  periodicRemaining: number
  eventAvailable: number
}

/** 当前签到日命中的基础奖励解析结果。 */
export interface CheckInResolvedReward {
  resolvedRewardSourceType: CheckInRewardSourceTypeEnum | null
  resolvedRewardRuleKey: string | null
  resolvedRewardItems: GrowthRewardItems | null
}

/** 重算连续签到聚合结果。 */
export interface CheckInStreakAggregation {
  currentStreak: number
  streakStartedAt?: string
  lastSignedDate?: string
  streakByDate: Record<string, number>
}

/** 补签消费来源。 */
export interface CheckInMakeupConsumePlanItem {
  sourceType: CheckInMakeupSourceTypeEnum
  amount: number
}
