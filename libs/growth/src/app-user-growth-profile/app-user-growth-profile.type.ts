import type { IntegrityLockRequest } from '@db/core'
import type { UserLevelRuleSelect } from '@db/schema'

/**
 * APP 用户成长余额快照。
 *
 * 仅表示积分与经验两类热余额，供成长资料、用户资料映射和登录读模型复用。
 */
export interface AppUserGrowthSnapshot {
  points: number
  experience: number
}

/** 新用户初始化前在事务外冻结的默认等级与完整锁请求集。 */
export interface NewAppUserDefaultLevelLockPlan {
  readonly defaultLevelId: UserLevelRuleSelect['id'] | null
  readonly lockRequests: readonly IntegrityLockRequest[]
}

/** 持锁权威重读默认等级后的稳定解析结果。 */
export interface NewAppUserDefaultLevelStableResolution {
  readonly outcome: 'stable'
  readonly defaultLevelId: UserLevelRuleSelect['id'] | null
}

/** 默认等级谓词在事务外发现与持锁重读之间发生变化。 */
export interface NewAppUserDefaultLevelSnapshotDrift {
  readonly outcome: 'snapshot-drift'
}

/** 新用户默认等级持锁解析的闭集结果。 */
export type NewAppUserDefaultLevelResolution =
  NewAppUserDefaultLevelStableResolution | NewAppUserDefaultLevelSnapshotDrift

/** 注册事务内成长初始化的闭集结果。 */
export type NewAppUserGrowthInitializationOutcome =
  'initialized' | 'snapshot-drift'
