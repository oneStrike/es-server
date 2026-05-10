/// <reference types="jest" />

import { UserAssetsService } from './user-assets.service'

describe('UserAssetsService wallet read model contract', () => {
  it('projects wallet detail from the cross-asset summary owner', async () => {
    const service = new UserAssetsService({} as any)
    jest.spyOn(service, 'getUserAssetsSummary').mockResolvedValue({
      availableCouponCount: 2,
      commentCount: 6,
      currencyBalance: 100,
      downloadedChapterCount: 4,
      downloadedWorkCount: 3,
      favoriteCount: 7,
      likeCount: 8,
      purchasedChapterCount: 5,
      purchasedWorkCount: 1,
      viewCount: 9,
      vipExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
    })

    await expect(service.getWalletDetail(33)).resolves.toEqual({
      availableCouponCount: 2,
      currencyBalance: 100,
      purchasedChapterCount: 5,
      purchasedWorkCount: 1,
      vipExpiresAt: new Date('2026-06-01T00:00:00.000Z'),
    })
  })
})
