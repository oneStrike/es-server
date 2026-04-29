import { ForumUserActionTargetTypeEnum, ForumUserActionTypeEnum } from '../../action-log/action-log.constant'
import { ForumTopicCommentResolver } from './forum-topic-comment.resolver'
import { ForumTopicFavoriteResolver } from './forum-topic-favorite.resolver'
import { ForumTopicLikeResolver } from './forum-topic-like.resolver'

describe('forum topic action-log resolver hooks', () => {
  it('records create-comment actions in the forum topic comment resolver hook', async () => {
    const actionLogService = {
      createActionLogInTx: jest.fn().mockResolvedValue(true),
    }
    const forumCounterService = {
      syncTopicCommentState: jest.fn().mockResolvedValue(undefined),
      syncSectionVisibleState: jest.fn().mockResolvedValue(undefined),
    }
    const resolver = Reflect.construct(
      ForumTopicCommentResolver as unknown as new (
        ...args: unknown[]
      ) => ForumTopicCommentResolver,
      [
        { registerResolver: jest.fn() },
        { publishInTx: jest.fn() },
        { buildTopicCommentedEvent: jest.fn() },
        forumCounterService,
        actionLogService,
      ],
    ) as ForumTopicCommentResolver

    await resolver.postCommentHook?.(
      {} as never,
      {
        id: 33,
        userId: 7,
        targetType: 5 as never,
        targetId: 99,
        replyToId: 12,
        content: '评论内容',
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
      },
      {
        sectionId: 2,
        ownerUserId: 8,
        targetDisplayTitle: '测试主题',
      },
    )

    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 7,
        actionType: ForumUserActionTypeEnum.CREATE_COMMENT,
        targetType: ForumUserActionTargetTypeEnum.COMMENT,
        targetId: 33,
      }),
    )
  })

  it('records delete-comment actions in the forum topic comment resolver hook', async () => {
    const actionLogService = {
      createActionLogInTx: jest.fn().mockResolvedValue(true),
    }
    const forumCounterService = {
      syncTopicCommentState: jest.fn().mockResolvedValue(undefined),
      syncSectionVisibleState: jest.fn().mockResolvedValue(undefined),
    }
    const resolver = Reflect.construct(
      ForumTopicCommentResolver as unknown as new (
        ...args: unknown[]
      ) => ForumTopicCommentResolver,
      [
        { registerResolver: jest.fn() },
        { publishInTx: jest.fn() },
        { buildTopicCommentedEvent: jest.fn() },
        forumCounterService,
        actionLogService,
      ],
    ) as ForumTopicCommentResolver

    await resolver.postDeleteCommentHook?.(
      {} as never,
      {
        id: 44,
        userId: 5,
        targetType: 5 as never,
        targetId: 101,
        replyToId: null,
        createdAt: new Date('2026-04-28T00:00:00.000Z'),
      },
      {
        sectionId: 3,
      },
    )

    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 5,
        actionType: ForumUserActionTypeEnum.DELETE_COMMENT,
        targetType: ForumUserActionTargetTypeEnum.COMMENT,
        targetId: 44,
      }),
    )
  })

  it('records like and unlike topic actions in the forum topic like resolver hooks', async () => {
    const actionLogService = {
      createActionLogInTx: jest.fn().mockResolvedValue(true),
    }
    const resolver = Reflect.construct(
      ForumTopicLikeResolver as unknown as new (
        ...args: unknown[]
      ) => ForumTopicLikeResolver,
      [
        {},
        { registerResolver: jest.fn() },
        { publishInTx: jest.fn() },
        { buildTopicLikedEvent: jest.fn() },
        {},
        {},
        actionLogService,
      ],
    ) as ForumTopicLikeResolver

    await resolver.postLikeHook?.(
      {} as never,
      55,
      9,
      {
        sceneType: 3 as never,
        sceneId: 55,
        ownerUserId: 9,
      },
    )
    await (
      resolver as unknown as {
        postUnlikeHook?: (
          tx: unknown,
          targetId: number,
          actorUserId: number,
        ) => Promise<void>
      }
    ).postUnlikeHook?.({} as never, 55, 9)

    expect(actionLogService.createActionLogInTx).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        userId: 9,
        actionType: ForumUserActionTypeEnum.LIKE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: 55,
      }),
    )
    expect(actionLogService.createActionLogInTx).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        userId: 9,
        actionType: ForumUserActionTypeEnum.UNLIKE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: 55,
      }),
    )
  })

  it('records favorite and unfavorite topic actions in the forum topic favorite resolver hooks', async () => {
    const actionLogService = {
      createActionLogInTx: jest.fn().mockResolvedValue(true),
    }
    const resolver = Reflect.construct(
      ForumTopicFavoriteResolver as unknown as new (
        ...args: unknown[]
      ) => ForumTopicFavoriteResolver,
      [
        {},
        { registerResolver: jest.fn() },
        { publishInTx: jest.fn() },
        { buildTopicFavoritedEvent: jest.fn() },
        {},
        {},
        {},
        actionLogService,
      ],
    ) as ForumTopicFavoriteResolver

    await resolver.postFavoriteHook?.(
      {} as never,
      77,
      12,
      {
        ownerUserId: 12,
        targetTitle: '主题',
      },
    )
    await (
      resolver as unknown as {
        postUnfavoriteHook?: (
          tx: unknown,
          targetId: number,
          actorUserId: number,
        ) => Promise<void>
      }
    ).postUnfavoriteHook?.({} as never, 77, 12)

    expect(actionLogService.createActionLogInTx).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        userId: 12,
        actionType: ForumUserActionTypeEnum.FAVORITE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: 77,
      }),
    )
    expect(actionLogService.createActionLogInTx).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        userId: 12,
        actionType: ForumUserActionTypeEnum.UNFAVORITE_TOPIC,
        targetType: ForumUserActionTargetTypeEnum.TOPIC,
        targetId: 77,
      }),
    )
  })
})
