import { UserFollowResolver } from './user-follow.resolver'

describe('userFollowResolver', () => {
  it('postFollowHook 会把关注者昵称传给领域事件工厂', async () => {
    const factory = {
      buildUserFollowedEvent: jest.fn().mockReturnValue({
        eventKey: 'user.followed',
      }),
    }
    const publisher = {
      publishInTx: jest.fn().mockResolvedValue(undefined),
    }
    const resolver = new UserFollowResolver(
      {
        schema: {
          appUserCount: {},
        },
        db: {},
      } as any,
      {
        registerResolver: jest.fn(),
      } as any,
      {} as any,
      publisher as any,
      factory as any,
    )

    const tx = {
      query: {
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '小光',
          }),
        },
      },
    }

    await resolver.postFollowHook(
      tx as any,
      7,
      9,
      {
        ownerUserId: 7,
      },
    )

    expect(factory.buildUserFollowedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorNickname: '小光',
      }),
    )
    expect(publisher.publishInTx).toHaveBeenCalledTimes(1)
  })
})
