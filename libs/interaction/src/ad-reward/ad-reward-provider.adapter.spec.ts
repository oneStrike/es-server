/// <reference types="jest" />

import { createHmac } from 'node:crypto'
import {
  ClientPlatformEnum,
  ProviderEnvironmentEnum,
} from '../payment/payment.constant'
import { AdProviderEnum } from './ad-reward.constant'
import { PangleRewardProviderAdapter } from './ad-reward-provider.adapter'

const AD_VERIFY_SECRET_ENV = 'AD_REWARD_DOMAIN_TEST_SECRET'
const AD_VERIFY_SECRET = 'ad-provider-test-secret'

describe('Ad reward provider adapters', () => {
  beforeEach(() => {
    process.env[AD_VERIFY_SECRET_ENV] = AD_VERIFY_SECRET
  })

  afterEach(() => {
    delete process.env[AD_VERIFY_SECRET_ENV]
  })

  const baseInput = {
    userId: 9,
    config: {
      id: 1,
      provider: AdProviderEnum.PANGLE,
      platform: ClientPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      appId: 'pangle-app',
      placementKey: 'reward-low-price',
      targetScope: 1,
      dailyLimit: 3,
      configVersion: 1,
      credentialVersionRef: 'seed://ad/pangle/v1',
      callbackUrl: null,
      configMetadata: {
        verifySecretEnvKey: AD_VERIFY_SECRET_ENV,
      },
      sortOrder: 0,
      isEnabled: true,
      createdAt: new Date('2026-05-06T00:00:00.000Z'),
      updatedAt: new Date('2026-05-06T00:00:00.000Z'),
    },
    payload: {
      provider: AdProviderEnum.PANGLE,
      platform: ClientPlatformEnum.ANDROID,
      environment: ProviderEnvironmentEnum.SANDBOX,
      clientAppKey: 'default-app',
      appId: 'pangle-app',
      placementKey: 'reward-low-price',
      targetType: 1,
      targetId: 2,
      providerRewardId: 'reward-id',
    },
  }

  function signAdFields(fields: Record<string, number | string>) {
    const canonicalPayload = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join('\n')
    return createHmac('sha256', AD_VERIFY_SECRET)
      .update(canonicalPayload)
      .digest('hex')
  }

  function buildSignedAdInput() {
    const timestamp = Date.now()
    const nonce = 'nonce-1'
    const signedFields = {
      appId: baseInput.payload.appId,
      clientAppKey: baseInput.payload.clientAppKey,
      configVersion: baseInput.config.configVersion,
      credentialVersionRef: baseInput.config.credentialVersionRef,
      environment: baseInput.payload.environment,
      nonce,
      placementKey: baseInput.payload.placementKey,
      platform: baseInput.payload.platform,
      provider: baseInput.payload.provider,
      providerRewardId: baseInput.payload.providerRewardId,
      targetId: baseInput.payload.targetId,
      targetType: baseInput.payload.targetType,
      timestamp,
      userId: baseInput.userId,
    }
    return {
      ...baseInput,
      payload: {
        ...baseInput.payload,
        verifyPayload: {
          nonce,
          signType: 'HMAC_SHA256',
          signature: signAdFields(signedFields),
          timestamp,
        },
      },
    }
  }

  it('rejects unsigned reward callbacks', () => {
    const adapter = new PangleRewardProviderAdapter()

    expect(adapter.verifyRewardCallback(baseInput)).toBe(false)
  })

  it('verifies placement and parses provider reward id', () => {
    const adapter = new PangleRewardProviderAdapter()
    const input = buildSignedAdInput()

    expect(adapter.verifyRewardCallback(input)).toBe(true)
    expect(adapter.parseRewardPayload(input)).toEqual({
      placementKey: 'reward-low-price',
      providerRewardId: 'reward-id',
    })
  })
})
