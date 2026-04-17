import type { DrizzleService } from '@db/core'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'
import { MessageNotificationSubjectPayloadService } from './notification-subject-payload.service'

function createDrizzleServiceStub(overrides?: {
  forumTopic?: object | undefined
  work?: object | undefined
  workChapter?: object | undefined
  announcement?: object | undefined
  task?: object | undefined
}) {
  return {
    db: {
      query: {
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue(overrides?.forumTopic),
        },
        work: {
          findFirst: jest.fn().mockResolvedValue(overrides?.work),
        },
        workChapter: {
          findFirst: jest.fn().mockResolvedValue(overrides?.workChapter),
        },
        appAnnouncement: {
          findFirst: jest.fn().mockResolvedValue(overrides?.announcement),
        },
        task: {
          findFirst: jest.fn().mockResolvedValue(overrides?.task),
        },
      },
    },
  } as unknown as DrizzleService
}

describe('MessageNotificationSubjectPayloadService', () => {
  it('normalizes topic payload to canonical subject and removes legacy topic keys', async () => {
    const service = new MessageNotificationSubjectPayloadService(
      createDrizzleServiceStub({
        forumTopic: {
          id: 9,
          title: '帖子标题',
          sectionId: 3,
          images: ['https://example.com/topic-cover.png'],
        },
      }),
    )

    const payload = await service.normalizePayload(
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
      {
        actorNickname: '张三',
        topicTitle: '旧标题',
        targetType: 3,
        targetId: 9,
      },
    )

    expect(payload).toEqual({
      actorNickname: '张三',
      subject: {
        kind: 'topic',
        id: 9,
        title: '帖子标题',
        cover: 'https://example.com/topic-cover.png',
        extra: {
          sectionId: 3,
        },
      },
    })
  })

  it('normalizes chapter-bound comment payload to subject and parentSubject', async () => {
    const service = new MessageNotificationSubjectPayloadService(
      createDrizzleServiceStub({
        workChapter: {
          id: 17,
          title: '第 17 话',
          subtitle: '暴雨将至',
          cover: 'https://example.com/chapter-cover.png',
          workId: 8,
          workType: 1,
          work: {
            id: 8,
            name: '作品标题',
            cover: 'https://example.com/work-cover.png',
            type: 1,
          },
        },
      }),
    )

    const payload = await service.normalizePayload(
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.COMMENT_LIKE,
      {
        actorNickname: '李四',
        commentId: 101,
        targetType: 3,
        targetId: 17,
      },
    )

    expect(payload).toEqual({
      actorNickname: '李四',
      commentId: 101,
      subject: {
        kind: 'chapter',
        id: 17,
        title: '第 17 话',
        subtitle: '暴雨将至',
        cover: 'https://example.com/chapter-cover.png',
        extra: {
          workId: 8,
          workType: 1,
        },
      },
      parentSubject: {
        kind: 'work',
        id: 8,
        title: '作品标题',
        cover: 'https://example.com/work-cover.png',
        extra: {
          type: 1,
        },
      },
    })
  })

  it('falls back to a minimal subject when the entity snapshot is gone', async () => {
    const service = new MessageNotificationSubjectPayloadService(
      createDrizzleServiceStub(),
    )

    const payload = await service.normalizePayload(
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_MENTIONED,
      {
        actorNickname: '王五',
        topicTitle: '已删除的旧帖子',
        topicId: 99,
      },
    )

    expect(payload).toEqual({
      actorNickname: '王五',
      subject: {
        kind: 'topic',
        id: 99,
      },
    })
  })

  it('re-enriches a minimal canonical topic subject snapshot', async () => {
    const service = new MessageNotificationSubjectPayloadService(
      createDrizzleServiceStub({
        forumTopic: {
          id: 12,
          title: '重建后的主题标题',
          sectionId: 7,
          images: ['https://example.com/rebuilt-topic-cover.png'],
        },
      }),
    )

    const payload = await service.normalizePayload(
      MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.TOPIC_LIKE,
      {
        actorNickname: '周六',
        subject: {
          kind: 'topic',
          id: 12,
        },
      },
    )

    expect(payload).toEqual({
      actorNickname: '周六',
      subject: {
        kind: 'topic',
        id: 12,
        title: '重建后的主题标题',
        cover: 'https://example.com/rebuilt-topic-cover.png',
        extra: {
          sectionId: 7,
        },
      },
    })
  })
})
