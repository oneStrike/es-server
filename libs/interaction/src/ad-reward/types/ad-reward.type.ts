import type { AdProviderConfigSelect } from '@db/schema'
import type { AdProviderEnum } from '../ad-reward.constant'
import type { AdRewardVerificationDto } from '../dto/ad-reward.dto'

/**
 * 激励广告 provider 核查奖励回调所需的配置和客户端 payload。
 */
export interface AdRewardProviderVerifyInput {
  userId: number
  config: AdProviderConfigSelect
  payload: AdRewardVerificationDto
}

/**
 * 激励广告 provider 已验签奖励 payload 中 service 可消费的标准字段。
 */
export interface AdRewardProviderParsedPayload {
  providerRewardId: string
  placementKey: string
}

/**
 * 激励广告 provider 适配器契约，负责 provider 侧奖励回调验签和字段标准化。
 */
export interface AdRewardProviderAdapter {
  readonly provider: AdProviderEnum
  verifyRewardCallback: (input: AdRewardProviderVerifyInput) => boolean
  parseRewardPayload: (
    input: AdRewardProviderVerifyInput,
  ) => AdRewardProviderParsedPayload
}
