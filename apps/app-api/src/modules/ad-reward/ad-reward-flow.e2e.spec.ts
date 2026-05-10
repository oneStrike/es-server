/// <reference types="jest" />

import { AdRewardService } from '@libs/interaction/ad-reward/ad-reward.service'
import { UserAssetsService } from '@libs/interaction/user-assets/user-assets.service'
import { AdRewardController } from './ad-reward.controller'

describe('App ad-reward flow e2e substitute', () => {
  it('enters through app controller, verifies provider payload, grants reward, and supports readback', async () => {
    const assetState = { purchasedChapterCount: 0 }
    const rewardRecord = { id: 7, providerRewardId: 'reward-id' }
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(() => Promise.resolve([rewardRecord])),
          })),
        })),
      })),
      query: {
        adRewardRecord: {
          findFirst: jest.fn(() => Promise.resolve(undefined)),
        },
      },
    }
    const drizzle = {
      schema: {
        adRewardRecord: {
          adProviderConfigId: 'ad_reward_record.ad_provider_config_id',
          providerRewardId: 'ad_reward_record.provider_reward_id',
        },
      },
      withTransaction: jest.fn((callback: (runner: typeof tx) => unknown) =>
        callback(tx),
      ),
    }
    const contentEntitlementService = {
      grantEntitlement: jest.fn(() => {
        assetState.purchasedChapterCount += 1
        return Promise.resolve()
      }),
    }
    const service = new AdRewardService(
      drizzle as any,
      {} as any,
      contentEntitlementService as any,
    ) as any
    service.resolveAdProviderConfig = jest.fn(() =>
      Promise.resolve({
        configVersion: 1,
        credentialVersionRef: 'seed://ad/pangle/v1',
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
    const userAssetsService = new (class extends UserAssetsService {
      constructor() {
        super({} as any)
      }

      override async getUserAssetsSummary(userId: number) {
        expect(userId).toBe(33)
        return {
          availableCouponCount: 0,
          commentCount: 0,
          currencyBalance: 0,
          downloadedChapterCount: 0,
          downloadedWorkCount: 0,
          favoriteCount: 0,
          likeCount: 0,
          purchasedChapterCount: assetState.purchasedChapterCount,
          purchasedWorkCount: 1,
          viewCount: 0,
          vipExpiresAt: null,
        }
      }
    })()
    const controller = new AdRewardController(service)

    await expect(
      controller.verifyAdReward(
        {
          appId: 'pangle-app',
          clientAppKey: 'default-app',
          environment: 1,
          placementKey: 'reward-low-price',
          platform: 1,
          provider: 1,
          providerRewardId: 'reward-id',
          targetId: 2,
          targetType: 1,
        } as any,
        33,
      ),
    ).resolves.toEqual(rewardRecord)
    expect(contentEntitlementService.grantEntitlement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        sourceId: 7,
        sourceKey: 'reward-id',
        userId: 33,
      }),
    )
    await expect(userAssetsService.getWalletDetail(33)).resolves.toMatchObject({
      purchasedChapterCount: 1,
    })
  })
})
