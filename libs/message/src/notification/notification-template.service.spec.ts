import { BadRequestException } from '@nestjs/common'
import {
  getMessageNotificationTemplateDefinition,
  MessageNotificationTypeEnum,
} from './notification.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('message notification template service', () => {
  it('derives stable templateKey from notification type on create', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const values = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn(() => ({ values }))
    const service = new MessageNotificationTemplateService({
      db: { insert },
      schema: { notificationTemplate: {} },
      withErrorHandling: jest.fn(async (callback) => callback()),
      isUniqueViolation: jest.fn(() => false),
    } as any)

    await expect(
      service.createNotificationTemplate({
        notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
        titleTemplate: ' 收到新的评论回复 ',
        contentTemplate: ' 你收到了一条新的评论回复 ',
      }),
    ).resolves.toBe(true)

    expect(values).toHaveBeenCalledWith({
      notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
      templateKey: 'notification.comment-reply',
      titleTemplate: '收到新的评论回复',
      contentTemplate: '你收到了一条新的评论回复',
      isEnabled: true,
      remark: undefined,
    })
  })

  it('renders template placeholders from payload context', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const service = new MessageNotificationTemplateService({
      db: {
        query: {
          notificationTemplate: {
            findFirst: jest.fn().mockResolvedValue({
              id: 8,
              notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
              templateKey: 'notification.comment-reply',
              titleTemplate: '{{payload.actorNickname}} 回复了你',
              contentTemplate: '你在 {{payload.topicTitle}} 下收到了新回复',
              isEnabled: true,
            }),
          },
        },
      },
      schema: {
        notificationTemplate: {
          notificationType: 'notificationType',
          isEnabled: 'isEnabled',
        },
      },
    } as any)

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
          topicTitle: '进击的巨人：前三卷伏笔整理',
        },
      }),
    ).resolves.toEqual({
      title: '小光 回复了你',
      content: '你在 进击的巨人：前三卷伏笔整理 下收到了新回复',
      templateId: 8,
      templateKey: 'notification.comment-reply',
      usedTemplate: true,
    })
  })

  it('falls back to payload title and content when template render fails', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const service = new MessageNotificationTemplateService({
      db: {
        query: {
          notificationTemplate: {
            findFirst: jest.fn().mockResolvedValue({
              id: 9,
              notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
              templateKey: 'notification.comment-reply',
              titleTemplate: '{{payload.actorNickname}} 回复了你',
              contentTemplate: '你收到了一条新的评论回复',
              isEnabled: true,
            }),
          },
        },
      },
      schema: {
        notificationTemplate: {
          notificationType: 'notificationType',
          isEnabled: 'isEnabled',
        },
      },
    } as any)

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        title: 'fallback title',
        content: 'fallback content',
      }),
    ).resolves.toEqual({
      title: 'fallback title',
      content: 'fallback content',
      templateId: 9,
      templateKey: 'notification.comment-reply',
      usedTemplate: false,
      fallbackReason: 'render_failed',
    })
  })

  it('caches template lookups for both enabled and missing template results', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 8,
        notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
        templateKey: 'notification.comment-reply',
        titleTemplate: '{{payload.actorNickname}} 回复了你',
        contentTemplate: '{{payload.replyExcerpt}}',
        isEnabled: true,
      })
      .mockResolvedValueOnce(null)
    const service = new MessageNotificationTemplateService({
      db: {
        query: {
          notificationTemplate: {
            findFirst,
          },
        },
      },
      schema: {
        notificationTemplate: {
          notificationType: 'notificationType',
          isEnabled: 'isEnabled',
        },
      },
    } as any)

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
          replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: '小光 回复了你',
        content: '这里的伏笔其实从第一卷就开始了。',
        usedTemplate: true,
      }),
    )

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
          replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: '小光 回复了你',
        content: '这里的伏笔其实从第一卷就开始了。',
        usedTemplate: true,
      }),
    )

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_COMMENT,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
          commentExcerpt: '评论摘要',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'fallback title',
        content: 'fallback content',
        usedTemplate: false,
        fallbackReason: 'missing_or_disabled',
      }),
    )

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.TOPIC_COMMENT,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
          commentExcerpt: '评论摘要',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'fallback title',
        content: 'fallback content',
        usedTemplate: false,
        fallbackReason: 'missing_or_disabled',
      }),
    )

    expect(findFirst).toHaveBeenCalledTimes(2)
  })

  it('invalidates cached template after enabled switch changes template availability', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 8,
        notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
        templateKey: 'notification.comment-reply',
        titleTemplate: '{{payload.actorNickname}} 回复了你',
        contentTemplate: '{{payload.replyExcerpt}}',
        isEnabled: true,
      })
      .mockResolvedValueOnce({
        id: 8,
        notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
        templateKey: 'notification.comment-reply',
        titleTemplate: '{{payload.actorNickname}} 回复了你',
        contentTemplate: '{{payload.replyExcerpt}}',
        isEnabled: true,
      })
      .mockResolvedValueOnce(null)
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const service = new MessageNotificationTemplateService({
      db: {
        query: {
          notificationTemplate: {
            findFirst,
          },
        },
        update,
      },
      schema: {
        notificationTemplate: {
          id: 'id',
          notificationType: 'notificationType',
          isEnabled: 'isEnabled',
        },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      assertAffectedRows: jest.fn(),
    } as any)

    await service.renderNotificationTemplate({
      receiverUserId: 1001,
      actorUserId: 1002,
      type: MessageNotificationTypeEnum.COMMENT_REPLY,
      title: 'fallback title',
      content: 'fallback content',
      payload: {
        actorNickname: '小光',
        replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
      },
    })
    await service.renderNotificationTemplate({
      receiverUserId: 1001,
      actorUserId: 1002,
      type: MessageNotificationTypeEnum.COMMENT_REPLY,
      title: 'fallback title',
      content: 'fallback content',
      payload: {
        actorNickname: '小光',
        replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
      },
    })

    await expect(
      service.updateNotificationTemplateEnabled({
        id: 8,
        isEnabled: false,
      }),
    ).resolves.toBe(true)

    await expect(
      service.renderNotificationTemplate({
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
          replyExcerpt: '这里的伏笔其实从第一卷就开始了。',
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'fallback title',
        content: 'fallback content',
        usedTemplate: false,
        fallbackReason: 'missing_or_disabled',
      }),
    )

    expect(findFirst).toHaveBeenCalledTimes(3)
  })

  it('rejects unsupported payload placeholder on create', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const values = jest.fn().mockResolvedValue(undefined)
    const insert = jest.fn(() => ({ values }))
    const service = new MessageNotificationTemplateService({
      db: { insert },
      schema: { notificationTemplate: {} },
      withErrorHandling: jest.fn(async (callback) => callback()),
      isUniqueViolation: jest.fn(() => false),
    } as any)

    await expect(
      service.createNotificationTemplate({
        notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
        titleTemplate: '{{payload.topicTitle}} 回复了你的评论',
        contentTemplate: '{{payload.replyExcerpt}}',
      }),
    ).rejects.toThrow(BadRequestException)

    expect(values).not.toHaveBeenCalled()
  })

  it('revalidates existing templates when notification type changes on update', async () => {
    const { MessageNotificationTemplateService }
      = await import('./notification-template.service')

    const findFirst = jest.fn().mockResolvedValue({
      id: 8,
      notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
      templateKey: 'notification.comment-reply',
      titleTemplate: '{{payload.actorNickname}} 回复了你的评论',
      contentTemplate: '{{payload.replyExcerpt}}',
      isEnabled: true,
      remark: null,
    })
    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const service = new MessageNotificationTemplateService({
      db: {
        query: {
          notificationTemplate: {
            findFirst,
          },
        },
        update,
      },
      schema: {
        notificationTemplate: {
          id: 'id',
        },
      },
      withErrorHandling: jest.fn(async (callback) => callback()),
      isUniqueViolation: jest.fn(() => false),
      assertAffectedRows: jest.fn(),
    } as any)

    await expect(
      service.updateNotificationTemplate({
        id: 8,
        notificationType: MessageNotificationTypeEnum.TOPIC_LIKE,
      }),
    ).rejects.toThrow(BadRequestException)

    expect(update).not.toHaveBeenCalled()
  })

  it('registers dynamic default templates for topic like and favorite notifications', () => {
    expect(
      getMessageNotificationTemplateDefinition(
        MessageNotificationTypeEnum.TOPIC_LIKE,
      ),
    ).toEqual(
      expect.objectContaining({
        defaultTitleTemplate: '{{payload.actorNickname}} 点赞了你的主题',
        defaultContentTemplate: '{{payload.topicTitle}}',
      }),
    )

    expect(
      getMessageNotificationTemplateDefinition(
        MessageNotificationTypeEnum.TOPIC_FAVORITE,
      ),
    ).toEqual(
      expect.objectContaining({
        defaultTitleTemplate: '{{payload.actorNickname}} 收藏了你的主题',
        defaultContentTemplate: '{{payload.topicTitle}}',
      }),
    )

    expect(
      getMessageNotificationTemplateDefinition(
        MessageNotificationTypeEnum.TOPIC_COMMENT,
      ),
    ).toEqual(
      expect.objectContaining({
        defaultTitleTemplate: '{{payload.actorNickname}} 评论了你的主题',
        defaultContentTemplate: '{{payload.commentExcerpt}}',
      }),
    )

    expect(
      getMessageNotificationTemplateDefinition(
        MessageNotificationTypeEnum.COMMENT_REPLY,
      ),
    ).toEqual(
      expect.objectContaining({
        defaultTitleTemplate: '{{payload.actorNickname}} 回复了你的评论',
        defaultContentTemplate: '{{payload.replyExcerpt}}',
      }),
    )
  })
})
