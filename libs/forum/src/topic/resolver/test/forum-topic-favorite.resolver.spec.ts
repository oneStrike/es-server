import { FavoriteTargetTypeEnum } from '../../../../../interaction/src/favorite/favorite.constant'
import { MessageNotificationComposerService } from '../../../../../message/src/notification/notification-composer.service'
import { MessageNotificationTypeEnum } from '../../../../../message/src/notification/notification.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('@libs/interaction/favorite', () => ({
  FavoriteService: class {},
  FavoriteTargetTypeEnum: {
    FORUM_TOPIC: FavoriteTargetTypeEnum.FORUM_TOPIC,
  },
}))

jest.mock('@libs/message/notification', () => ({
  MessageNotificationComposerService: class {},
}))

jest.mock('@libs/message/outbox', () => ({
  MessageOutboxService: class {},
}))

jest.mock('../../forum-topic.service', () => ({
  ForumTopicService: class {},
}))

describe('forum topic favorite resolver', () => {
  it('returns owner and title from ensureExists for favorite notification composition', async () => {
    const { ForumTopicFavoriteResolver } = await import('../forum-topic-favorite.resolver')
    const resolver = new ForumTopicFavoriteResolver(
      {
        db: {},
      } as any,
      {
        registerResolver: jest.fn(),
      } as any,
      {} as any,
      new MessageNotificationComposerService(),
      {} as any,
      {} as any,
    )

    await expect(
      resolver.ensureExists(
        {
          query: {
            forumTopic: {
              findFirst: jest.fn().mockResolvedValue({
                userId: 1001,
                title: '进击的巨人：前三卷伏笔整理',
                section: {
                  isEnabled: true,
                  deletedAt: null,
                },
              }),
            },
          },
        } as any,
        9,
      ),
    ).resolves.toEqual({
      ownerUserId: 1001,
      targetTitle: '进击的巨人：前三卷伏笔整理',
    })
  })

  it('enqueues TOPIC_FAVORITE notification with dynamic fallback copy', async () => {
    const { ForumTopicFavoriteResolver } = await import('../forum-topic-favorite.resolver')
    const enqueueNotificationEventInTx = jest.fn().mockResolvedValue(undefined)
    const resolver = new ForumTopicFavoriteResolver(
      {
        db: {},
      } as any,
      {
        registerResolver: jest.fn(),
      } as any,
      {
        enqueueNotificationEventInTx,
      } as any,
      new MessageNotificationComposerService(),
      {} as any,
      {} as any,
    )

    await resolver.postFavoriteHook(
      {
        query: {
          appUser: {
            findFirst: jest.fn().mockResolvedValue({
              nickname: '阿澈',
            }),
          },
        },
      } as any,
      9,
      1003,
      {
        ownerUserId: 1001,
        targetTitle: '进击的巨人：前三卷伏笔整理',
      },
    )

    expect(enqueueNotificationEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bizKey: `notify:favorite:${FavoriteTargetTypeEnum.FORUM_TOPIC}:9:actor:1003:receiver:1001`,
        payload: expect.objectContaining({
          receiverUserId: 1001,
          actorUserId: 1003,
          type: MessageNotificationTypeEnum.TOPIC_FAVORITE,
          title: '阿澈 收藏了你的主题',
          content: '进击的巨人：前三卷伏笔整理',
          payload: {
            actorNickname: '阿澈',
            topicTitle: '进击的巨人：前三卷伏笔整理',
          },
        }),
      }),
    )
  })
})
