import { SceneTypeEnum } from '@libs/platform/constant'
import { LikeTargetTypeEnum } from './like.constant'
import { LikeService } from './like.service'

function createLikeServiceHarness() {
  const tx = {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ id: 1 }]),
    }),
  }
  const drizzle = {
    db: {},
    schema: {
      userLike: {},
    },
    ext: {},
    withTransaction: jest.fn(async (callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
    assertAffectedRows: jest.fn(),
    extractError: jest.fn(),
  }
  const likeGrowthService = {
    rewardLikeCreated: jest.fn().mockResolvedValue(undefined),
  }
  const appUserCountService = {
    updateLikeCount: jest.fn().mockResolvedValue(undefined),
  }

  const service = new LikeService(
    likeGrowthService as never,
    appUserCountService as never,
    drizzle as never,
  )

  return {
    service,
    tx,
  }
}

describe('LikeService hook integration', () => {
  it('invokes the resolver unlike hook after removing a like record', async () => {
    const harness = createLikeServiceHarness()
    const resolver = {
      targetType: LikeTargetTypeEnum.FORUM_TOPIC,
      resolveMeta: jest.fn().mockResolvedValue({
        sceneType: SceneTypeEnum.FORUM_TOPIC,
        sceneId: 10,
      }),
      applyCountDelta: jest.fn().mockResolvedValue(undefined),
      postUnlikeHook: jest.fn().mockResolvedValue(undefined),
    }
    harness.service.registerResolver(resolver as never)

    await harness.service.unlike({
      targetType: LikeTargetTypeEnum.FORUM_TOPIC,
      targetId: 10,
      userId: 7,
    })

    expect(resolver.postUnlikeHook).toHaveBeenCalledWith(harness.tx, 10, 7)
  })
})
