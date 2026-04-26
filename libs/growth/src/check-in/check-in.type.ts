import type {
  CheckInConfigSelect,
  CheckInMakeupAccountSelect,
  CheckInRecordSelect,
  CheckInStreakGrantSelect,
  CheckInStreakProgressSelect,
  CheckInStreakRuleRewardItemSelect,
  CheckInStreakRuleSelect,
  GrowthRewardSettlementSelect,
} from '@db/schema'
import type { GrowthLedgerSourceEnum } from '@libs/growth/growth-ledger/growth-ledger.constant'
import type {
  GrowthRewardItem,
  GrowthRewardItems,
} from '../reward-rule/reward-item.type'
import type {
  CheckInMakeupSourceTypeEnum,
  CheckInOperatorTypeEnum,
  CheckInRecordTypeEnum,
  CheckInRewardSourceTypeEnum,
} from './check-in.constant'
import type { CheckInDateRewardRuleFieldsDto } from './dto/check-in-date-reward-rule.dto'
import type {
  PublishCheckInStreakRuleDto,
  QueryCheckInStreakRulePageDto,
} from './dto/check-in-definition.dto'
import type { BaseCheckInPatternRewardRuleDto } from './dto/check-in-pattern-reward-rule.dto'
import type {
  CheckInCalendarDayDto,
  CheckInMakeupSummaryDto,
  CheckInReconciliationPageItemDto,
} from './dto/check-in-runtime.dto'
import type { CheckInGrantItemDto } from './dto/check-in-streak-reward-grant.dto'
import type { BaseCheckInStreakRewardRuleDto } from './dto/check-in-streak-reward-rule.dto'

/** 签到域内部复用的日期输入。 */
export type CheckInDateLike = Date | string

/** 签到域内部复用的可空日期输入。 */
export type CheckInNullableDateLike = Date | string | null | undefined

/** 奖励项解析时统一使用的空值策略。 */
export interface CheckInAllowEmptyOption {
  allowEmpty: boolean
}

/** 稳定领域类型 `CheckInRewardItem`。用于签到域的奖励展示与快照语义。 */
export interface CheckInRewardItem extends GrowthRewardItem {
  iconUrl?: string | null
}

/** 稳定领域类型 `CheckInRewardItems`。仅供签到域内部和签到 DTO 复用。 */
export type CheckInRewardItems = CheckInRewardItem[]

/** 签到动作上下文的开放键集合。 */
export type CheckInSignRequestContext = Record<string, unknown>

/** 签到主流程输入。 */
export interface CheckInPerformSignInput {
  userId: number
  signDate: string
  recordType: CheckInRecordTypeEnum
  operatorType: CheckInOperatorTypeEnum
  context?: CheckInSignRequestContext
}

/** 单次签到写入后返回的事实与连续奖励结果。 */
export interface CheckInSignAction {
  recordId: number
  triggeredGrantIds: number[]
}

/** 奖励补偿重试时共享的操作上下文。 */
export interface CheckInRewardSettlementContext {
  actorUserId?: number
  isRetry?: boolean
}

/** 奖励落账调用的内部输入。 */
export interface CheckInRewardApplyInput {
  userId: number
  rewardItems: GrowthRewardItems
  baseBizKey: string
  source: GrowthLedgerSourceEnum
  actorUserId?: number
}

/** 需要懒创建基础奖励结算事实的签到记录快照。 */
export interface CheckInRecordRewardSettlementSource {
  id: number
  userId: number
  signDate: CheckInDateLike
  resolvedRewardItems: unknown
  rewardSettlementId?: number | null
}

/** 需要懒创建连续奖励结算事实的发放记录快照。 */
export interface CheckInGrantRewardSettlementSource {
  id: number
  userId: number
  ruleId: number
  ruleCode: string
  triggerSignDate: CheckInDateLike
  rewardItems: unknown
  rewardSettlementId?: number | null
}

/** 连续签到进度乐观锁更新只依赖的最小字段集。 */
export type CheckInStreakProgressSnapshot = Pick<
  CheckInStreakProgressSelect,
  'id' | 'version'
>

/** 门面和定义服务共用的规则 ID 查询结构。 */
export interface CheckInRuleIdQuery {
  id: number
}

type CheckInReplaceFields<TBase, TOverride> = Omit<TBase, keyof TOverride> &
  TOverride

type CheckInRewardItemsView<TBase> = CheckInReplaceFields<
  TBase,
  { rewardItems: CheckInRewardItems }
>

type CheckInNullableRewardItemsView<TBase> = CheckInReplaceFields<
  TBase,
  { rewardItems: CheckInRewardItems | null }
>

/** 基于日期奖励 DTO 收敛出的内部日期奖励视图。 */
export type CheckInDateRewardRuleView =
  CheckInRewardItemsView<CheckInDateRewardRuleFieldsDto>

/** 持久化配置里用于冻结历史语义的日期奖励视图，可显式表达“当日无奖励”。 */
export type CheckInStoredDateRewardRuleView = CheckInReplaceFields<
  CheckInDateRewardRuleView,
  { rewardItems: CheckInRewardItems | null }
>

/** 允许传入标准 DTO 或已归一化视图的日期奖励输入。 */
export type CheckInDateRewardRuleInput =
  | CheckInDateRewardRuleFieldsDto
  | CheckInDateRewardRuleView

/** 基于模式奖励 DTO 收敛出的内部周期奖励视图。 */
export type CheckInPatternRewardRuleView =
  CheckInRewardItemsView<BaseCheckInPatternRewardRuleDto>

/** 允许传入标准 DTO 或已归一化视图的周期奖励输入。 */
export type CheckInPatternRewardRuleInput =
  | BaseCheckInPatternRewardRuleDto
  | CheckInPatternRewardRuleView

/** 基于连续奖励 DTO 收敛出的内部连续奖励视图。 */
export type CheckInStreakRewardRuleView = CheckInRewardItemsView<
  Required<BaseCheckInStreakRewardRuleDto>
>

/** 允许传入标准 DTO 或已归一化视图的连续奖励输入。 */
export type CheckInStreakRewardRuleInput =
  | BaseCheckInStreakRewardRuleDto
  | CheckInStreakRewardRuleView

/** 奖励项解析时允许为空的输入载荷。 */
export type CheckInOptionalRewardItems = CheckInRewardItems | null | undefined

/** 全局签到奖励定义。 */
export interface CheckInRewardDefinition {
  baseRewardItems: CheckInRewardItems | null
  dateRewardRules: CheckInStoredDateRewardRuleView[]
  patternRewardRules: CheckInPatternRewardRuleView[]
  makeupIconUrl: string | null
  rewardOverviewIconUrl: string | null
}

/** 解析奖励定义时依赖的最小配置字段集。 */
export type CheckInRewardDefinitionSource = Pick<
  CheckInConfigSelect,
  | 'makeupPeriodType'
  | 'makeupIconUrl'
  | 'rewardOverviewIconUrl'
  | 'baseRewardItems'
  | 'dateRewardRules'
  | 'patternRewardRules'
>

/** 连续签到规则的公共字段骨架。 */
type CheckInStreakRuleBase = Pick<
  CheckInStreakRuleSelect,
  | 'ruleCode'
  | 'streakDays'
  | 'version'
  | 'status'
  | 'publishStrategy'
  | 'effectiveFrom'
  | 'effectiveTo'
  | 'repeatable'
>

/** 基于签到规则 schema 收敛出的内部连续签到版本定义。 */
export type CheckInStreakRuleDefinition = CheckInStreakRuleBase & {
  rewardItems: CheckInRewardItems
}

/** 解析连续签到版本定义时依赖的规则快照。 */
export type CheckInStreakRuleDefinitionSource = CheckInStreakRuleDefinition

/** 计算连续签到动态状态时依赖的规则窗口字段。 */
export type CheckInStreakRuleStatusWindow = Pick<
  CheckInStreakRuleSelect,
  'status' | 'effectiveFrom' | 'effectiveTo'
>

/** 校验激活规则重复天数时依赖的最小规则字段集。 */
export type CheckInActiveStreakDayRule = Pick<
  CheckInStreakRuleSelect,
  'id' | 'streakDays'
>

/** 连续签到规则奖励项的最小快照字段集。 */
export type CheckInStreakRewardItemSnapshot = Pick<
  CheckInStreakRuleRewardItemSelect,
  'assetType' | 'assetKey' | 'amount' | 'iconUrl'
>

/** 转换成连续奖励展示视图前依赖的规则行结构。 */
export type CheckInStreakRuleViewSource = Pick<
  CheckInStreakRuleSelect,
  | 'ruleCode'
  | 'streakDays'
  | 'repeatable'
  | 'status'
  | 'effectiveFrom'
  | 'effectiveTo'
> & {
  rewardItems: CheckInStreakRewardItemSnapshot[]
}

/** 基于补签摘要 DTO 收敛出的内部补签窗口视图。 */
export type CheckInMakeupWindowView = Pick<
  CheckInMakeupSummaryDto,
  'periodType' | 'periodKey' | 'periodStartDate' | 'periodEndDate'
>

/** 基于补签摘要 DTO 收敛出的内部补签账户读模型。 */
export type CheckInMakeupAccountView = CheckInMakeupSummaryDto

/** 计算补签消费计划时依赖的账户余额字段。 */
export type CheckInMakeupAccountBalance = Pick<
  CheckInMakeupAccountSelect,
  'periodicGranted' | 'periodicUsed' | 'eventAvailable'
>

/** 当前签到日命中的基础奖励解析结果。 */
export interface CheckInResolvedReward {
  resolvedRewardSourceType: CheckInRewardSourceTypeEnum | null
  resolvedRewardRuleKey: string | null
  resolvedRewardItems: CheckInRewardItems | null
  resolvedRewardOverviewIconUrl: string | null
  resolvedMakeupIconUrl: string | null
}

/** 基于连续奖励 DTO 收敛出的内部连续奖励展示视图。 */
export type CheckInGrantItemView = CheckInRewardItemsView<CheckInGrantItemDto>

/** 连续奖励去重与重复发放判断依赖的历史发放字段。 */
export type CheckInGrantTriggerView = Pick<
  CheckInStreakGrantSelect,
  'ruleCode' | 'triggerSignDate'
>

/** 连续奖励解析后的候选发放项。 */
export interface CheckInEligibleGrantCandidate {
  rule: CheckInStreakRewardRuleView
  triggerSignDate: string
}

/** 基于日历 DTO 收敛出的内部日历日视图。 */
export type CheckInCalendarDayView =
  CheckInNullableRewardItemsView<CheckInCalendarDayDto>

/** 基于对账 DTO 收敛出的内部对账分页项视图。 */
export type CheckInReconciliationPageItemView = CheckInReplaceFields<
  CheckInReconciliationPageItemDto,
  {
    resolvedRewardItems: CheckInRewardItems | null
    grants: CheckInGrantItemView[]
  }
>

type CheckInRecordLookupRow = Pick<CheckInRecordSelect, 'userId' | 'signDate'>

/** 运行时读取记录日期时依赖的最小字段集。 */
export type CheckInRecordDateOnlyView = Pick<CheckInRecordLookupRow, 'signDate'>

/** 运行时批量关联连续奖励时依赖的签到记录定位字段。 */
export type CheckInRecordGrantLookup = CheckInRecordLookupRow

/** 重算连续签到聚合结果。 */
export interface CheckInStreakAggregation {
  currentStreak: number
  streakStartedAt?: string
  lastSignedDate?: string
  streakByDate: Record<string, number>
}

/** 重算连续签到时允许的作用域限制。 */
export interface CheckInStreakAggregationOptions {
  streakStartedAt?: string | null
}

/** 补签消费来源。 */
export interface CheckInMakeupConsumePlanItem {
  sourceType: CheckInMakeupSourceTypeEnum
  amount: number
}

/** 对外补偿摘要复用的最小结算字段集。 */
export type CheckInRewardSettlementSummaryRecord = Pick<
  GrowthRewardSettlementSelect,
  | 'id'
  | 'settlementStatus'
  | 'settlementResultType'
  | 'ledgerRecordIds'
  | 'retryCount'
  | 'lastRetryAt'
  | 'settledAt'
  | 'lastError'
>

/** 对外补偿摘要允许的可空输入。 */
export type CheckInOptionalRewardSettlementSummary =
  | CheckInRewardSettlementSummaryRecord
  | null
  | undefined

/** Drizzle execute 结果在签到模块内的最小结构约束。 */
export type CheckInExecutedRowsResult<T> =
  | { rows?: T[] | null }
  | object
  | null
  | undefined

type StreakRulePageSortableRow = Pick<
  CheckInStreakRuleSelect,
  | 'id'
  | 'ruleCode'
  | 'streakDays'
  | 'version'
  | 'status'
  | 'publishStrategy'
  | 'repeatable'
  | 'effectiveFrom'
  | 'effectiveTo'
  | 'createdAt'
  | 'updatedAt'
>

/** 连续签到分页允许排序的字段集合。 */
export type StreakRulePageOrderField = keyof StreakRulePageSortableRow

/** 连续签到分页排序方向。 */
export type StreakRulePageOrderDirection = 'asc' | 'desc'

/** 连续签到分页单个排序项。 */
export interface StreakRulePageOrderItem {
  direction: StreakRulePageOrderDirection
  field: StreakRulePageOrderField
}

/** 连续签到主列表代表行。 */
export type StreakRulePageRow = StreakRulePageSortableRow &
  Pick<CheckInStreakRuleSelect, 'updatedById'>

/** 连续签到主列表查询真正依赖的过滤字段。 */
export type StreakRulePageQuery = Pick<
  QueryCheckInStreakRulePageDto,
  'status' | 'streakDays'
>

/** 连续签到代表行排序选择依赖的状态筛选值。 */
export type StreakRulePageStatus = QueryCheckInStreakRulePageDto['status']

/** 解析发布时间时真正依赖的 DTO 字段。 */
export type CheckInPublishEffectiveInput = Pick<
  PublishCheckInStreakRuleDto,
  'effectiveFrom' | 'publishStrategy'
>
