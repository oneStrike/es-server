import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { FavoriteTargetTypeEnum } from './favorite.constant'

jest.mock('@libs/growth/growth-reward', () => ({
  GrowthEventBridgeService: class {},
}))

describe('favorite growth service', () => {
  it('routes favorite rewards through the unified growth reward service', async () => {
    const { FavoriteGrowthService } = await import('./favorite-growth.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const service = new FavoriteGrowthService(
      { dispatchDefinedEvent } as any,
      { withTransaction: jest.fn(async (callback) => callback({} as any)) } as any,
    )

    await expect(
      service.rewardFavoriteCreated(FavoriteTargetTypeEnum.FORUM_TOPIC, 88, 9),
    ).resolves.toBeUndefined()

    expect(dispatchDefinedEvent).toHaveBeenCalledTimes(1)
    expect(dispatchDefinedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tx: expect.anything(),
        eventEnvelope: expect.objectContaining({
          code: GrowthRuleTypeEnum.TOPIC_FAVORITED,
          subjectId: 9,
          targetId: 88,
        }),
        bizKey: `favorite:${FavoriteTargetTypeEnum.FORUM_TOPIC}:88:user:9`,
        source: 'favorite',
      }),
    )
  })
})
