import { CommentLikeResolver } from './comment-like.resolver'

describe('commentLikeResolver', () => {
  it('postLikeHook 会把点赞者昵称传给领域事件工厂', async () => {
    const factory = {
      buildCommentLikeEvent: jest.fn().mockReturnValue({
        eventKey: 'comment.liked',
      }),
    }
    const publisher = {
      publishInTx: jest.fn().mockResolvedValue(undefined),
    }
    const resolver = new CommentLikeResolver(
      {
        registerResolver: jest.fn(),
      } as any,
      publisher as any,
      factory as any,
      {} as any,
      {
        schema: {
          appUserCount: {},
        },
        db: {},
      } as any,
    )

    const tx = {
      query: {
        userComment: {
          findFirst: jest.fn().mockResolvedValue({
            id: 101,
            userId: 7,
            targetType: 5,
            targetId: 77,
          }),
        },
        appUser: {
          findFirst: jest.fn().mockResolvedValue({
            nickname: '阿澈',
          }),
        },
      },
    }

    await resolver.postLikeHook(tx as any, 101, 9, {} as any)

    expect(factory.buildCommentLikeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorNickname: '阿澈',
      }),
    )
    expect(publisher.publishInTx).toHaveBeenCalledTimes(1)
  })
})
