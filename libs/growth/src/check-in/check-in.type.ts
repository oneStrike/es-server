import type { CheckInStreakRuleSelect } from '@db/schema'
import type { GrowthRewardItems } from '../reward-rule/reward-item.type'
import type {
  CheckInMakeupSourceTypeEnum,
  CheckInRewardSourceTypeEnum,
} from './check-in.constant'
import type { CheckInDateRewardRuleFieldsDto } from './dto/check-in-date-reward-rule.dto'
import type { BaseCheckInPatternRewardRuleDto } from './dto/check-in-pattern-reward-rule.dto'
import type {
  CheckInCalendarDayDto,
  CheckInMakeupSummaryDto,
  CheckInReconciliationPageItemDto,
} from './dto/check-in-runtime.dto'
import type { CheckInGrantItemDto } from './dto/check-in-streak-reward-grant.dto'
import type { BaseCheckInStreakRewardRuleDto } from './dto/check-in-streak-reward-rule.dto'

/** 基于日期奖励 DTO 收敛出的内部日期奖励视图。 */
export type CheckInDateRewardRuleView = Pick<
  CheckInDateRewardRuleFieldsDto,
  'rewardDate'
> & {
  rewardItems: GrowthRewardItems
}

/** 基于模式奖励 DTO 收敛出的内部周期奖励视图。 */
export type CheckInPatternRewardRuleView = Pick<
  BaseCheckInPatternRewardRuleDto,
  'patternType'
> & {
  weekday: number | null
  monthDay: number | null
  rewardItems: GrowthRewardItems
}

/** 基于连续奖励 DTO 收敛出的内部连续奖励视图。 */
export type CheckInStreakRewardRuleView = Pick<
  Required<BaseCheckInStreakRewardRuleDto>,
  'ruleCode' | 'streakDays' | 'repeatable' | 'status'
> & {
  rewardItems: GrowthRewardItems
}

/** 全局签到奖励定义。 */
export interface CheckInRewardDefinition {
  baseRewardItems: GrowthRewardItems | null
  dateRewardRules: CheckInDateRewardRuleView[]
  patternRewardRules: CheckInPatternRewardRuleView[]
}

/** 基于签到规则 schema 收敛出的内部连续签到版本定义。 */
export type CheckInStreakRuleDefinition = Pick<
  CheckInStreakRuleSelect,
  | 'ruleCode'
  | 'streakDays'
  | 'version'
  | 'status'
  | 'publishStrategy'
  | 'repeatable'
  | 'effectiveFrom'
  | 'effectiveTo'
> & {
  rewardItems: GrowthRewardItems
}

/** 基于补签摘要 DTO 收敛出的内部补签窗口视图。 */
export type CheckInMakeupWindowView = Pick<
  CheckInMakeupSummaryDto,
  'periodType' | 'periodKey' | 'periodStartDate' | 'periodEndDate'
>

/** 基于补签摘要 DTO 收敛出的内部补签账户读模型。 */
export type CheckInMakeupAccountView = Pick<
  CheckInMakeupSummaryDto,
  | 'periodType'
  | 'periodKey'
  | 'periodStartDate'
  | 'periodEndDate'
  | 'periodicGranted'
  | 'periodicUsed'
  | 'periodicRemaining'
  | 'eventAvailable'
>

/** 当前签到日命中的基础奖励解析结果。 */
export interface CheckInResolvedReward {
  resolvedRewardSourceType: CheckInRewardSourceTypeEnum | null
  resolvedRewardRuleKey: string | null
  resolvedRewardItems: GrowthRewardItems | null
}

/** 基于连续奖励 DTO 收敛出的内部连续奖励展示视图。 */
export type CheckInGrantItemView = Pick<
  CheckInGrantItemDto,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'userId'
  | 'ruleId'
  | 'ruleCode'
  | 'streakDays'
  | 'rewardItems'
  | 'repeatable'
  | 'triggerSignDate'
  | 'rewardSettlementId'
  | 'rewardSettlement'
>

/** 基于日历 DTO 收敛出的内部日历日视图。 */
export type CheckInCalendarDayView = Pick<
  CheckInCalendarDayDto,
  | 'signDate'
  | 'dayIndex'
  | 'isToday'
  | 'isFuture'
  | 'isSigned'
  | 'grantCount'
  | 'rewardItems'
  | 'rewardSettlement'
>

/** 基于对账 DTO 收敛出的内部对账分页项视图。 */
export type CheckInReconciliationPageItemView = Pick<
  CheckInReconciliationPageItemDto,
  | 'recordId'
  | 'userId'
  | 'signDate'
  | 'recordType'
  | 'rewardSettlementId'
  | 'resolvedRewardSourceType'
  | 'resolvedRewardRuleKey'
  | 'resolvedRewardItems'
  | 'rewardSettlement'
  | 'grants'
  | 'createdAt'
  | 'updatedAt'
>

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
