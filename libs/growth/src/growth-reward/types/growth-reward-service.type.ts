import type { Db } from '@db/core'
import type { GrowthRewardRuleSelect } from '@db/schema'
import type { EventEnvelope } from '../../event-definition/event-envelope.type'
import type { GrowthRuleTypeEnum } from '../../growth-rule.constant'
import type { GrowthRewardItems } from '../../reward-rule/reward-item.type'
import type { TaskRewardSettlementResultTypeEnum } from '../../task/task.constant'
import type { GrowthRuleRewardAssetResult, TaskRewardAssetResult } from './growth-reward-result.type'

/** 按成长规则发奖时使用的内部入参。 */
export interface RewardByRuleParams {
  userId: number
  ruleType: GrowthRuleTypeEnum
  bizKey: string
  source: string
  targetType?: number
  targetId?: number
  context?: Record<string, unknown>
  occurredAt?: Date
  tx?: Db
}

/** 任务完成奖励结算时使用的内部入参。 */
export interface RewardTaskCompleteParams {
  userId: number
  taskId: number
  instanceId: number
  rewardItems?: GrowthRewardItems | null
  eventEnvelope?: EventEnvelope
}

/** 成长奖励规则最小投影。 */
export type GrowthRewardRuleProjection = Pick<
  GrowthRewardRuleSelect,
  'id' | 'assetType' | 'assetKey' | 'isEnabled'
>

/** 成长奖励规则资产标识。 */
export type GrowthRewardRuleAssetIdentity = Pick<
  GrowthRewardRuleProjection,
  'assetType' | 'assetKey'
>

/** 任务奖励结算结果构造入参。 */
export interface BuildTaskRewardSettlementResultParams {
  bizKey: string
  rewardItems: GrowthRewardItems
  settledAt: Date
  rewardResults: TaskRewardAssetResult[]
  resultType: TaskRewardSettlementResultTypeEnum
  errorMessage?: string
}

/** 成长规则奖励结算结果构造入参。 */
export interface BuildRuleRewardSettlementResultParams {
  params: RewardByRuleParams
  rewardResults: GrowthRuleRewardAssetResult[]
}

/** 事务复用回调。 */
export type RunWithOptionalTransactionCallback<T> = (runner: Db) => Promise<T>
