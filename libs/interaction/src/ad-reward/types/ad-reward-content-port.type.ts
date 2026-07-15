import type { DbTransaction } from '@db/core'
import type { AdRewardRecordSelect } from '@db/schema'
import type { AdTargetScopeEnum } from '../ad-reward.constant'

/**
 * 广告奖励请求内容域校验时需要的最小目标信息。
 * 内容适配器据此校验章节权限、目标类型和广告解锁限制。
 */
export interface ResolveAdRewardContentTargetInput {
  targetScope: AdTargetScopeEnum
  requestedTargetType: number
  targetId: number
}

/**
 * 内容域确认后的广告奖励目标。
 * targetType 是已由内容域映射并校验的内容权益闭集值。
 */
export interface ResolvedAdRewardContentTarget {
  targetType: number
}

/**
 * 广告奖励记录关联内容权益时需要的最小记录投影。
 */
export type AdRewardEntitlementReference = Pick<
  AdRewardRecordSelect,
  'id' | 'userId' | 'targetType' | 'targetId'
>

/**
 * 对账页消费的内容权益投影。
 * 内容状态不跨域泄漏，仅提供当前对账所需的存在性、有效性和过期时间。
 */
export interface AdRewardContentAccessProjection {
  isActive: boolean
  expiresAt: Date | null
}

/**
 * 在广告奖励事务内授予临时内容访问权所需的事实快照。
 */
export interface GrantAdRewardTemporaryAccessInput {
  userId: number
  targetType: number
  targetId: number
  sourceId: number
  sourceKey: string
  expiresAt: Date
  grantSnapshot: {
    adProviderConfigId: number
    adProviderConfigVersion: number
    credentialVersionRef: string
    placementKey: string
    targetScope: AdTargetScopeEnum
  }
}

/**
 * 广告奖励消费内容域能力的最小同步端口。
 * 事务由 interaction 广告奖励 use case 发起并显式透传，适配器不得另开事务。
 */
export interface AdRewardContentPort {
  resolveTarget: (
    input: ResolveAdRewardContentTargetInput,
  ) => Promise<ResolvedAdRewardContentTarget>
  grantTemporaryAccess: (
    tx: DbTransaction,
    input: GrantAdRewardTemporaryAccessInput,
  ) => Promise<void>
  revokeTemporaryAccessByReward: (
    tx: DbTransaction,
    rewardRecordId: number,
  ) => Promise<number>
  getAccessProjections: (
    records: AdRewardEntitlementReference[],
  ) => Promise<Map<number, AdRewardContentAccessProjection>>
}
