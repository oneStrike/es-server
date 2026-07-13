import type { AdProviderConfigSelect } from '@db/schema'
import type { ProviderEnvironmentEnum } from '../../payment/payment.constant'
import type { AdProviderEnum } from '../ad-reward.constant'
import type { AdRewardVerificationDto } from '../dto/ad-reward.dto'

/**
 * 广告回调验签与奖励写入实际消费的 provider 配置字段。
 */
export type AdRewardProviderVerificationConfig = Pick<
  AdProviderConfigSelect,
  | 'id'
  | 'provider'
  | 'platform'
  | 'environment'
  | 'clientAppKey'
  | 'appId'
  | 'placementKey'
  | 'targetScope'
  | 'dailyLimit'
  | 'configVersion'
  | 'credentialVersionRef'
  | 'configMetadata'
  | 'isEnabled'
>

/**
 * 激励广告 provider 核查奖励回调所需的配置和客户端 payload。
 */
export interface AdRewardProviderVerifyInput {
  userId: number
  config: AdRewardProviderVerificationConfig
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

/** 管理端可选择的广告验签密钥定义，映射 provider、环境与环境变量名。 */
export interface AdRewardCredentialOptionDefinition {
  value: string
  label: string
  provider: AdProviderEnum
  environment: ProviderEnvironmentEnum
  envKey: string
}

/** 广告提供者配置更新入参，允许部分字段更新。 */
export type AdProviderConfigUpdateInput = Partial<
  import('../dto/ad-reward.dto').AdProviderConfigWritableFieldsDto
>
