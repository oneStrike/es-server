import { MessageNotificationTypeEnum } from './notification.constant'

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
})
