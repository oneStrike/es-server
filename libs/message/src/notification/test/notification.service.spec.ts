import {
  MessageNotificationDispatchStatusEnum,
  MessageNotificationTypeEnum,
} from '../notification.constant'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
}))

describe('message notification service', () => {
  it('uses rendered template content when creating notification from outbox', async () => {
    const { MessageNotificationService } = await import('../notification.service')

    const returning = jest.fn().mockResolvedValue([
      {
        id: 1,
        userId: 1001,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        bizKey: 'comment:reply:1:to:1001',
        title: '模板标题',
        content: '模板正文',
        isRead: false,
        createdAt: new Date('2026-03-28T12:00:00.000Z'),
      },
    ])
    const onConflictDoNothing = jest.fn(() => ({ returning }))
    const values = jest.fn(() => ({ onConflictDoNothing }))
    const insert = jest.fn(() => ({ values }))
    const renderNotificationTemplate = jest.fn().mockResolvedValue({
      title: '模板标题',
      content: '模板正文',
      templateKey: 'notification.comment-reply',
      usedTemplate: true,
    })
    const emitNotificationNew = jest.fn()
    const getSummary = jest.fn().mockResolvedValue({
      notificationUnreadCount: 1,
      chatUnreadCount: 0,
      totalUnreadCount: 1,
    })
    const emitInboxSummaryUpdate = jest.fn()

    const service = new MessageNotificationService(
      {
        db: { insert },
        schema: {
          appUserNotification: {
            userId: 'userId',
            bizKey: 'bizKey',
          },
        },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      {
        emitNotificationNew,
        emitInboxSummaryUpdate,
      } as any,
      {
        getSummary,
      } as any,
      {
        getEffectiveNotificationPreference: jest.fn().mockResolvedValue({
          notificationType: MessageNotificationTypeEnum.COMMENT_REPLY,
          notificationTypeLabel: '评论回复通知',
          isEnabled: true,
          defaultEnabled: true,
          source: 'default',
        }),
      } as any,
      {
        renderNotificationTemplate,
      } as any,
    )

    await expect(
      service.createFromOutbox('comment:reply:1:to:1001', {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        targetType: 4,
        targetId: 88,
        subjectType: 1,
        subjectId: 99,
        title: 'fallback title',
        content: 'fallback content',
        payload: {
          actorNickname: '小光',
        },
      }),
    ).resolves.toEqual({
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
      notification: expect.objectContaining({
        id: 1,
        title: '模板标题',
        content: '模板正文',
      }),
    })

    expect(renderNotificationTemplate).toHaveBeenCalledWith({
      receiverUserId: 1001,
      actorUserId: 1002,
      type: MessageNotificationTypeEnum.COMMENT_REPLY,
      targetType: 4,
      targetId: 88,
      subjectType: 1,
      subjectId: 99,
      title: 'fallback title',
      content: 'fallback content',
      payload: {
        actorNickname: '小光',
      },
      aggregateKey: undefined,
      aggregateCount: undefined,
      expiredAt: undefined,
    })
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1001,
        type: MessageNotificationTypeEnum.COMMENT_REPLY,
        bizKey: 'comment:reply:1:to:1001',
        title: '模板标题',
        content: '模板正文',
      }),
    )
    expect(emitNotificationNew).toHaveBeenCalled()
    expect(getSummary).toHaveBeenCalledWith(1001)
    expect(emitInboxSummaryUpdate).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({
        totalUnreadCount: 1,
      }),
    )
  })

  it('skips notification creation when user preference is disabled', async () => {
    const { MessageNotificationService } = await import('../notification.service')

    const insert = jest.fn()
    const renderNotificationTemplate = jest.fn()
    const getEffectiveNotificationPreference = jest.fn().mockResolvedValue({
      notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
      notificationTypeLabel: '评论点赞通知',
      isEnabled: false,
      defaultEnabled: true,
      source: 'explicit',
      preferenceId: 7,
    })
    const service = new MessageNotificationService(
      {
        db: { insert },
        schema: {
          appUserNotification: {},
        },
      } as any,
      {} as any,
      {} as any,
      {
        getEffectiveNotificationPreference,
      } as any,
      {
        renderNotificationTemplate,
      } as any,
    )

    await expect(
      service.createFromOutbox('comment:like:1:to:1001', {
        receiverUserId: 1001,
        actorUserId: 1002,
        type: MessageNotificationTypeEnum.COMMENT_LIKE,
        title: 'fallback title',
        content: 'fallback content',
      }),
    ).resolves.toEqual({
      status: MessageNotificationDispatchStatusEnum.SKIPPED_PREFERENCE,
      preference: expect.objectContaining({
        notificationType: MessageNotificationTypeEnum.COMMENT_LIKE,
        isEnabled: false,
        preferenceId: 7,
      }),
    })

    expect(insert).not.toHaveBeenCalled()
    expect(renderNotificationTemplate).not.toHaveBeenCalled()
  })
})
