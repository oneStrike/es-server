/// <reference types="jest" />

import 'reflect-metadata'
import { PATH_METADATA } from '@nestjs/common/constants'
import { AdRewardController } from './ad-reward.controller'

describe('App AdRewardController route smoke', () => {
  it('registers app ad-reward verification route and forwards current user context', async () => {
    const adRewardService = {
      verifyAdReward: jest.fn(() =>
        Promise.resolve({ id: 7, providerRewardId: 'reward-id' }),
      ),
    }
    const controller = new AdRewardController(adRewardService as any)

    expect(Reflect.getMetadata(PATH_METADATA, AdRewardController)).toBe(
      'app/ad-reward',
    )
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        AdRewardController.prototype.verifyAdReward,
      ),
    ).toBe('verification/create')

    await expect(
      controller.verifyAdReward({ providerRewardId: 'reward-id' } as any, 33),
    ).resolves.toEqual({ id: 7, providerRewardId: 'reward-id' })
    expect(adRewardService.verifyAdReward).toHaveBeenCalledWith(33, {
      providerRewardId: 'reward-id',
    })
  })
})
