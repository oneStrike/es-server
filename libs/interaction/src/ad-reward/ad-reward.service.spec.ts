/// <reference types="jest" />

import { AdRewardService } from './ad-reward.service'

describe('AdRewardService domain split contract', () => {
  it('returns existing reward records for duplicate provider rewards without granting twice', async () => {
    const existingRecord = { id: 7, providerRewardId: 'reward-id' }
    const drizzle = {
      withTransaction: jest.fn((callback: (tx: unknown) => unknown) =>
        callback({
          query: {
            adRewardRecord: {
              findFirst: jest.fn(() => Promise.resolve(existingRecord)),
            },
          },
        }),
      ),
    }
    const contentEntitlementService = { grantEntitlement: jest.fn() }
    const service = new AdRewardService(
      drizzle as any,
      {} as any,
      contentEntitlementService as any,
    ) as any
    service.resolveAdProviderConfig = jest.fn(() =>
      Promise.resolve({
        configVersion: 1,
        dailyLimit: 0,
        id: 1,
      }),
    )
    service.getAdRewardAdapter = jest.fn(() => ({
      parseRewardPayload: jest.fn(() => ({
        placementKey: 'reward-low-price',
        providerRewardId: 'reward-id',
      })),
      verifyRewardCallback: jest.fn(() => true),
    }))
    service.assertAdTargetAllowed = jest.fn()

    await expect(
      service.verifyAdReward(3, {
        appId: 'app-id',
        clientAppKey: 'default-app',
        environment: 1,
        placementKey: 'reward-low-price',
        platform: 1,
        provider: 1,
        providerRewardId: 'reward-id',
        targetId: 2,
        targetType: 1,
      }),
    ).resolves.toEqual(existingRecord)
    expect(contentEntitlementService.grantEntitlement).not.toHaveBeenCalled()
  })
})
