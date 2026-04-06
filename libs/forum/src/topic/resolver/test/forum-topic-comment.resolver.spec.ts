import { CommentTargetTypeEnum } from '../../../../../interaction/src/comment/comment.constant'
import { MessageNotificationComposerService } from '../../../../../message/src/notification/notification-composer.service'
import { MessageNotificationTypeEnum } from '../../../../../message/src/notification/notification.constant'

jest.mock('@libs/interaction/comment/comment.service', () => ({
  CommentService: class {}
}))

jest.mock('@libs/interaction/comment/comment.constant', () => ({
  CommentTargetTypeEnum: {
    FORUM_TOPIC: CommentTargetTypeEnum.FORUM_TOPIC,
  }
}))

jest.mock('@libs/message/notification/notification-composer.service', () => ({
  MessageNotificationComposerService: class {}
}))

jest.mock('@libs/message/outbox/outbox.service', () => ({
  MessageOutboxService: class {}
}))

describe('forum topic comment resolver', () => {
  it('resolves topic owner, section and title for topic comment notification', async () => {
    const { ForumTopicCommentResolver } = await import('../forum-topic-comment.resolver')
    const resolver = new ForumTopicCommentResolver(
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
                userId: 1001,
                sectionId: 6,
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
      ownerUserId: 1001,
      sectionId: 6,
      targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
    })
  })

  it('keeps forum counters in sync and enqueues TOPIC_COMMENT for first-level comments', async () => {
    const { ForumTopicCommentResolver } = await import('../forum-topic-comment.resolver')
    const enqueueNotificationEventInTx = jest.fn().mockResolvedValue(undefined)
    const syncTopicCommentState = jest.fn().mockResolvedValue(undefined)
    const syncSectionVisibleState = jest.fn().mockResolvedValue(undefined)
    const resolver = new ForumTopicCommentResolver(
      {
        registerResolver: jest.fn(),
      } as any,
      {
        enqueueNotificationEventInTx,
      } as any,
      new MessageNotificationComposerService(),
      {
        syncTopicCommentState,
        syncSectionVisibleState,
      } as any,
    )

    await resolver.postCommentHook(
      {
        query: {
          appUser: {
            findFirst: jest.fn().mockResolvedValue({
              nickname: '小光',
            }),
          },
        },
      } as any,
      {
        id: 31,
        userId: 1002,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 8,
        replyToId: null,
        content: '  第一卷的伏笔其实很早就埋下了。  ',
        createdAt: new Date('2026-03-30T08:30:00.000Z'),
      },
      {
        ownerUserId: 1001,
        sectionId: 6,
        targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
      },
    )

    expect(syncTopicCommentState).toHaveBeenCalledWith(expect.anything(), 8)
    expect(syncSectionVisibleState).toHaveBeenCalledWith(expect.anything(), 6)
    expect(enqueueNotificationEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bizKey: 'notify:topic-comment:5:8:comment:31:receiver:1001',
        payload: expect.objectContaining({
          receiverUserId: 1001,
          actorUserId: 1002,
          type: MessageNotificationTypeEnum.TOPIC_COMMENT,
          title: '小光 评论了你的主题',
          content: '第一卷的伏笔其实很早就埋下了。',
          payload: {
            actorNickname: '小光',
            topicTitle: '进击的巨人：前三卷伏笔整理',
            commentExcerpt: '第一卷的伏笔其实很早就埋下了。',
          },
        }),
      }),
    )
  })

  it('keeps forum counters in sync but skips TOPIC_COMMENT for reply comments', async () => {
    const { ForumTopicCommentResolver } = await import('../forum-topic-comment.resolver')
    const enqueueNotificationEventInTx = jest.fn().mockResolvedValue(undefined)
    const syncTopicCommentState = jest.fn().mockResolvedValue(undefined)
    const syncSectionVisibleState = jest.fn().mockResolvedValue(undefined)
    const actorFindFirst = jest.fn()
    const resolver = new ForumTopicCommentResolver(
      {
        registerResolver: jest.fn(),
      } as any,
      {
        enqueueNotificationEventInTx,
      } as any,
      new MessageNotificationComposerService(),
      {
        syncTopicCommentState,
        syncSectionVisibleState,
      } as any,
    )

    await resolver.postCommentHook(
      {
        query: {
          appUser: {
            findFirst: actorFindFirst,
          },
        },
      } as any,
      {
        id: 32,
        userId: 1002,
        targetType: CommentTargetTypeEnum.FORUM_TOPIC,
        targetId: 8,
        replyToId: 77,
        content: '回复内容',
        createdAt: new Date('2026-03-30T08:31:00.000Z'),
        replyTargetUserId: 42,
      },
      {
        ownerUserId: 1001,
        sectionId: 6,
        targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
      },
    )

    expect(syncTopicCommentState).toHaveBeenCalledWith(expect.anything(), 8)
    expect(syncSectionVisibleState).toHaveBeenCalledWith(expect.anything(), 6)
    expect(actorFindFirst).not.toHaveBeenCalled()
    expect(enqueueNotificationEventInTx).not.toHaveBeenCalled()
  })
})
