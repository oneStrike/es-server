import { FavoriteTargetTypeEnum } from '../favorite.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('@libs/user', () => ({
  AppUserCountService: class {},
}))

describe('favorite service', () => {
  it('passes targetTitle to postFavoriteHook for downstream notification composition', async () => {
    const { FavoriteService } = await import('../favorite.service')

    const rewardFavoriteCreated = jest.fn().mockResolvedValue(undefined)
    const updateFavoriteCount = jest.fn().mockResolvedValue(undefined)
    const applyCountDelta = jest.fn().mockResolvedValue(undefined)
    const postFavoriteHook = jest.fn().mockResolvedValue(undefined)
    const ensureExists = jest.fn().mockResolvedValue({
      ownerUserId: 88,
      targetTitle: '进击的巨人：前三卷伏笔整理',
    })
    const returning = jest.fn().mockResolvedValue([{ id: 1 }])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const tx = {
      insert,
    }

    const service = new FavoriteService(
      {
        rewardFavoriteCreated,
      } as any,
      {
        updateFavoriteCount,
      } as any,
      {
        schema: {
          userFavorite: {
            id: 'id',
          },
        },
        withTransaction: jest.fn(async (callback) => callback(tx)),
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
    )

    service.registerResolver({
      targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
      ensureExists,
      applyCountDelta,
      postFavoriteHook,
    } as any)

    await expect(
      service.favorite({
        targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
        targetId: 9,
        userId: 1001,
      }),
    ).resolves.toEqual({ id: 1 })

    expect(ensureExists).toHaveBeenCalledWith(tx, 9)
    expect(updateFavoriteCount).toHaveBeenCalledWith(tx, 1001, 1)
    expect(applyCountDelta).toHaveBeenCalledWith(tx, 9, 1)
    expect(postFavoriteHook).toHaveBeenCalledWith(tx, 9, 1001, {
      ownerUserId: 88,
      targetTitle: '进击的巨人：前三卷伏笔整理',
    })
    expect(rewardFavoriteCreated).toHaveBeenCalledWith(
      FavoriteTargetTypeEnum.FORUM_TOPIC,
      9,
      1001,
    )
  })
})
