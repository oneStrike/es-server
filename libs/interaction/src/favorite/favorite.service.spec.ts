import { FavoriteTargetTypeEnum } from './favorite.constant'
import { FavoriteService } from './favorite.service'

function createFavoriteServiceHarness() {
  const tx = {
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ id: 1 }]),
    }),
  }
  const drizzle = {
    db: {},
    schema: {
      userFavorite: {},
    },
    ext: {},
    withTransaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    assertAffectedRows: jest.fn(),
    extractError: jest.fn(),
  }
  const favoriteGrowthService = {
    rewardFavoriteCreated: jest.fn().mockResolvedValue(undefined),
  }
  const appUserCountService = {
    updateFavoriteCount: jest.fn().mockResolvedValue(undefined),
  }

  const service = new FavoriteService(
    favoriteGrowthService as never,
    appUserCountService as never,
    drizzle as never,
  )

  return {
    service,
    tx,
  }
}

describe('FavoriteService hook integration', () => {
  it('invokes the resolver unfavorite hook after removing a favorite record', async () => {
    const harness = createFavoriteServiceHarness()
    const resolver = {
      targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
      ensureExists: jest.fn(),
      applyCountDelta: jest.fn().mockResolvedValue(undefined),
      postUnfavoriteHook: jest.fn().mockResolvedValue(undefined),
    }
    harness.service.registerResolver(resolver as never)

    await harness.service.unfavorite({
      targetType: FavoriteTargetTypeEnum.FORUM_TOPIC,
      targetId: 11,
      userId: 9,
    })

    expect(resolver.postUnfavoriteHook).toHaveBeenCalledWith(
      harness.tx,
      11,
      9,
    )
  })
})
