import { MessageNotificationComposerService } from '../notification-composer.service'
import {
  MessageNotificationSubjectTypeEnum,
  MessageNotificationTypeEnum,
} from '../notification.constant'

describe('message notification composer service', () => {
  it('builds topic like event with typed payload and dynamic fallback copy', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildTopicLikeEvent({
        bizKey: 'notify:like:forum-topic:8:actor:1002:receiver:1001',
        receiverUserId: 1001,
        actorUserId: 1002,
        targetType: 7,
        targetId: 8,
        payload: {
          actorNickname: '小光',
          topicTitle: '进击的巨人：前三卷伏笔整理',
        },
      }),
    ).toEqual({
      bizKey: 'notify:like:forum-topic:8:actor:1002:receiver:1001',
      payload: {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_LIKE,
        targetType: 7,
        targetId: 8,
        subjectType: undefined,
        subjectId: undefined,
        title: '小光 点赞了你的主题',
        content: '进击的巨人：前三卷伏笔整理',
        payload: {
          actorNickname: '小光',
          topicTitle: '进击的巨人：前三卷伏笔整理',
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })

  it('builds topic favorite event with readable fallbacks when payload snapshot is empty', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildTopicFavoriteEvent({
        bizKey: 'notify:favorite:forum-topic:9:actor:1003:receiver:1001',
        receiverUserId: 1001,
        actorUserId: 1003,
        targetType: 7,
        targetId: 9,
        payload: {
          actorNickname: ' ',
          topicTitle: '',
        },
      }),
    ).toEqual({
      bizKey: 'notify:favorite:forum-topic:9:actor:1003:receiver:1001',
      payload: {
        receiverUserId: 1001,
        actorUserId: 1003,
        type: MessageNotificationTypeEnum.TOPIC_FAVORITE,
        targetType: 7,
        targetId: 9,
        subjectType: undefined,
        subjectId: undefined,
        title: '有人 收藏了你的主题',
        content: '你的主题',
        payload: {
          actorNickname: '有人',
          topicTitle: '你的主题',
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })

  it('builds topic comment event with dynamic title and comment excerpt body', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildTopicCommentEvent({
        bizKey: 'notify:topic-comment:5:8:comment:31:receiver:1001',
        receiverUserId: 1001,
        actorUserId: 1002,
        targetType: 5,
        targetId: 8,
        subjectId: 31,
        payload: {
          actorNickname: '小光',
          topicTitle: '进击的巨人：前三卷伏笔整理',
          commentExcerpt: '  第一卷的伏笔其实很早就埋下了。  ',
        },
      }),
    ).toEqual({
      bizKey: 'notify:topic-comment:5:8:comment:31:receiver:1001',
      payload: {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_COMMENT,
        targetType: 5,
        targetId: 8,
        subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
        subjectId: 31,
        title: '小光 评论了你的主题',
        content: '第一卷的伏笔其实很早就埋下了。',
        payload: {
          actorNickname: '小光',
          topicTitle: '进击的巨人：前三卷伏笔整理',
          commentExcerpt: '第一卷的伏笔其实很早就埋下了。',
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })

  it('falls back to topic title when topic comment excerpt is empty', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildTopicCommentEvent({
        bizKey: 'notify:topic-comment:5:8:comment:32:receiver:1001',
        receiverUserId: 1001,
        actorUserId: 1002,
        targetType: 5,
        targetId: 8,
        subjectId: 32,
        payload: {
          actorNickname: ' ',
          topicTitle: '进击的巨人：前三卷伏笔整理',
          commentExcerpt: '\n',
        },
      }),
    ).toEqual({
      bizKey: 'notify:topic-comment:5:8:comment:32:receiver:1001',
      payload: {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_COMMENT,
        targetType: 5,
        targetId: 8,
        subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
        subjectId: 32,
        title: '有人 评论了你的主题',
        content: '进击的巨人：前三卷伏笔整理',
        payload: {
          actorNickname: '有人',
          topicTitle: '进击的巨人：前三卷伏笔整理',
          commentExcerpt: '进击的巨人：前三卷伏笔整理',
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })

  it('builds comment reply event with comment subject snapshot contract', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildCommentReplyEvent({
        bizKey: 'comment:reply:31:to:42',
        receiverUserId: 42,
        actorUserId: 11,
        targetType: 4,
        targetId: 901,
        subjectId: 31,
        payload: {
          actorNickname: '阿澈',
          replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
          targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
        },
      }),
    ).toEqual({
      bizKey: 'comment:reply:31:to:42',
      payload: {
        receiverUserId: 42,
        actorUserId: 11,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        targetType: 4,
        targetId: 901,
        subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
        subjectId: 31,
        title: '阿澈 回复了你的评论',
        content: '这里的伏笔其实从第一卷就开始了。',
        payload: {
          actorNickname: '阿澈',
          replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
          targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })

  it('falls back to targetDisplayTitle before using fixed copy when reply excerpt is empty', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildCommentReplyEvent({
        bizKey: 'comment:reply:32:to:42',
        receiverUserId: 42,
        actorUserId: 11,
        targetType: 4,
        targetId: 901,
        subjectId: 32,
        payload: {
          actorNickname: '阿澈',
          replyExcerpt: ' \n ',
          targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
        },
      }),
    ).toEqual({
      bizKey: 'comment:reply:32:to:42',
      payload: {
        receiverUserId: 42,
        actorUserId: 11,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        targetType: 4,
        targetId: 901,
        subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
        subjectId: 32,
        title: '阿澈 回复了你的评论',
        content: '进击的巨人：前三卷伏笔整理',
        payload: {
          actorNickname: '阿澈',
          replyExcerpt: '进击的巨人：前三卷伏笔整理',
          targetDisplayTitle: '进击的巨人：前三卷伏笔整理',
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })

  it('falls back to fixed copy when both reply excerpt and target title are missing', () => {
    const service = new MessageNotificationComposerService()

    expect(
      service.buildCommentReplyEvent({
        bizKey: 'comment:reply:33:to:42',
        receiverUserId: 42,
        actorUserId: 11,
        targetType: 4,
        targetId: 901,
        subjectId: 33,
        payload: {
          actorNickname: '',
          replyExcerpt: '',
          targetDisplayTitle: ' ',
        },
      }),
    ).toEqual({
      bizKey: 'comment:reply:33:to:42',
      payload: {
        receiverUserId: 42,
        actorUserId: 11,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        targetType: 4,
        targetId: 901,
        subjectType: MessageNotificationSubjectTypeEnum.COMMENT,
        subjectId: 33,
        title: '有人 回复了你的评论',
        content: '你收到了一条新的评论回复',
        payload: {
          actorNickname: '有人',
          replyExcerpt: undefined,
          targetDisplayTitle: undefined,
        },
        aggregateKey: undefined,
        aggregateCount: undefined,
        expiredAt: undefined,
      },
    })
  })
})
