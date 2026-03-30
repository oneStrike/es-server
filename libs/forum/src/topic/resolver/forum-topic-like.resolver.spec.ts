import { SceneTypeEnum } from '@libs/platform/constant'
import { LikeTargetTypeEnum } from '../../../../interaction/src/like/like.constant'
import { MessageNotificationComposerService } from '../../../../message/src/notification/notification-composer.service'
import { MessageNotificationTypeEnum } from '../../../../message/src/notification/notification.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

jest.mock('@libs/interaction/like', () => ({
  LikeService: class {},
  LikeTargetTypeEnum: {
    FORUM_TOPIC: LikeTargetTypeEnum.FORUM_TOPIC,
  },
}))

jest.mock('@libs/message/notification', () => ({
  MessageNotificationComposerService: class {},
}))

jest.mock('@libs/message/outbox', () => ({
  MessageOutboxService: class {},
}))

describe('forum topic like resolver', () => {
  it('resolves topic owner and title into like target meta', async () => {
    const { ForumTopicLikeResolver } = await import('./forum-topic-like.resolver')
    const resolver = new ForumTopicLikeResolver(
      {
        db: {},
      } as any,
      {
        registerResolver: jest.fn(),
      } as any,
      {} as any,
      new MessageNotificationComposerService(),
      {} as any,
    )

    await expect(
      resolver.resolveMeta(
        {
          query: {
            forumTopic: {
              findFirst: jest.fn().mockResolvedValue({
                id: 8,
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
        8,
      ),
    ).resolves.toEqual({
      sceneType: SceneTypeEnum.FORUM_TOPIC,
      sceneId: 8,
      ownerUserId: 1001,
      targetTitle: '进击的巨人：前三卷伏笔整理',
    })
  })

  it('enqueues TOPIC_LIKE notification with dynamic fallback copy', async () => {
    const { ForumTopicLikeResolver } = await import('./forum-topic-like.resolver')
    const enqueueNotificationEventInTx = jest.fn().mockResolvedValue(undefined)
    const resolver = new ForumTopicLikeResolver(
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
    )

    await resolver.postLikeHook(
      {
        query: {
          appUser: {
            findFirst: jest.fn().mockResolvedValue({
              nickname: '小光',
            }),
          },
        },
      } as any,
      8,
      1002,
      {
        sceneType: SceneTypeEnum.FORUM_TOPIC,
        sceneId: 8,
        ownerUserId: 1001,
        targetTitle: '进击的巨人：前三卷伏笔整理',
      },
    )

    expect(enqueueNotificationEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bizKey: `notify:like:${LikeTargetTypeEnum.FORUM_TOPIC}:8:actor:1002:receiver:1001`,
        payload: expect.objectContaining({
          receiverUserId: 1001,
          actorUserId: 1002,
          type: MessageNotificationTypeEnum.TOPIC_LIKE,
          title: '小光 点赞了你的主题',
          content: '进击的巨人：前三卷伏笔整理',
          payload: {
            actorNickname: '小光',
            topicTitle: '进击的巨人：前三卷伏笔整理',
          },
        }),
      }),
    )
  })
})
