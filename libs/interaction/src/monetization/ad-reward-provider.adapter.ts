import type {
  AdRewardProviderAdapter,
  AdRewardProviderVerifyInput,
} from './monetization.type'
import { AdProviderEnum } from './monetization.constant'
import {
  isFreshTimestamp,
  readNumberField,
  readRecord,
  readStringField,
  readVerificationSecret,
  verifyHmacSha256Signature,
} from './provider-verification.util'

const AD_REWARD_SIGNATURE_MAX_SKEW_MS = 10 * 60 * 1000

abstract class BaseAdRewardProviderAdapter implements AdRewardProviderAdapter {
  abstract readonly provider: AdProviderEnum

  verifyRewardCallback(input: AdRewardProviderVerifyInput) {
    const verifyPayload = readRecord(input.payload.verifyPayload)
    const nonce = readStringField(verifyPayload, 'nonce')
    const signType = readStringField(verifyPayload, 'signType')
    const signature = readStringField(verifyPayload, 'signature')
    const timestamp = readNumberField(verifyPayload, 'timestamp')
    const clientAppKey = input.payload.clientAppKey?.trim() ?? ''
    const appId = input.payload.appId?.trim() ?? ''

    if (
      !input.config.isEnabled ||
      input.config.provider !== this.provider ||
      input.payload.provider !== this.provider ||
      input.config.platform !== input.payload.platform ||
      input.config.environment !== input.payload.environment ||
      input.config.clientAppKey !== clientAppKey ||
      input.config.appId !== appId ||
      input.config.placementKey !== input.payload.placementKey ||
      !nonce ||
      signType !== 'HMAC_SHA256' ||
      !signature ||
      timestamp === null ||
      !isFreshTimestamp(timestamp, AD_REWARD_SIGNATURE_MAX_SKEW_MS)
    ) {
      return false
    }

    const secret = readVerificationSecret(input.config.configMetadata)
    if (!secret) {
      return false
    }

    return verifyHmacSha256Signature({
      secret,
      signature,
      fields: {
        appId,
        clientAppKey,
        configVersion: input.config.configVersion,
        credentialVersionRef: input.config.credentialVersionRef,
        environment: input.payload.environment,
        nonce,
        placementKey: input.payload.placementKey,
        platform: input.payload.platform,
        provider: this.provider,
        providerRewardId: input.payload.providerRewardId,
        targetId: input.payload.targetId,
        targetType: input.payload.targetType,
        timestamp,
        userId: input.userId,
      },
    })
  }

  parseRewardPayload(input: AdRewardProviderVerifyInput) {
    return {
      providerRewardId: input.payload.providerRewardId,
      placementKey: input.payload.placementKey,
    }
  }
}

export class PangleRewardProviderAdapter extends BaseAdRewardProviderAdapter {
  readonly provider = AdProviderEnum.PANGLE
}

export class YoulianghuiRewardProviderAdapter extends BaseAdRewardProviderAdapter {
  readonly provider = AdProviderEnum.TENCENT_YOU_LIANG_HUI
}

export const AD_REWARD_PROVIDER_ADAPTERS: AdRewardProviderAdapter[] = [
  new PangleRewardProviderAdapter(),
  new YoulianghuiRewardProviderAdapter(),
]
