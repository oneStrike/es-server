import type { CheckInRecordSelect, CheckInStreakGrantSelect } from '@db/schema'
import type { CheckInRewardItems } from './check-in.type'

/** 签到日历聚合时读取的最小签到事实字段集。 */
export type CheckInCalendarRecordAggregateSource = Pick<
  CheckInRecordSelect,
  | 'userId'
  | 'signDate'
  | 'recordType'
  | 'resolvedRewardItems'
  | 'resolvedRewardOverviewIconUrl'
>

/** 签到日历统计连续奖励触发次数时读取的最小发放字段集。 */
export type CheckInCalendarGrantCountSource = Pick<
  CheckInStreakGrantSelect,
  'id' | 'triggerSignDate'
>

/** 后台全局周期日历单日聚合结果。 */
export interface CheckInAdminCalendarDayAggregate {
  signDate: string
  dayIndex: number
  isToday: boolean
  isFuture: boolean
  signedCount: number
  normalSignCount: number
  makeupSignCount: number
  streakRewardTriggerCount: number
  baseRewardConfigProjectionOverview: CheckInRewardItems | null
  baseRewardConfigProjectionOverviewIconUrl: string | null
  baseRewardActualOverview: CheckInRewardItems | null
  baseRewardActualOverviewIconUrl: string | null
}
