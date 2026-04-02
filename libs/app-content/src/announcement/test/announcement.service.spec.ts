jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/message/outbox', () => ({
  MessageOutboxService: class {},
}))

jest.mock('@libs/message/notification', () => ({
  MessageNotificationTypeEnum: {
    COMMENT_REPLY: 1,
    COMMENT_LIKE: 2,
    CONTENT_FAVORITE: 3,
    USER_FOLLOW: 4,
    SYSTEM_ANNOUNCEMENT: 5,
    CHAT_MESSAGE: 6,
    TASK_REMINDER: 7,
  },
  MessageNotificationSubjectTypeEnum: {
    SYSTEM: 4,
  },
}))

describe('app announcement service', () => {
  it('fanouts important published announcement into notification outbox', async () => {
    const { AppAnnouncementService } = await import('../announcement.service')
    const { AnnouncementPriorityEnum } = await import('../announcement.constant')
    const { MessageNotificationTypeEnum } = await import('@libs/message/notification')

    const returning = jest.fn().mockResolvedValue([{ id: 88 }])
    const values = jest.fn(() => ({ returning }))
    const insert = jest.fn(() => ({ values }))
    const where = jest.fn().mockResolvedValue([{ id: 1001 }, { id: 1002 }])
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const enqueueNotificationEvents = jest.fn().mockResolvedValue(undefined)

    const service = new AppAnnouncementService(
      {
        db: {
          insert,
          select,
          query: {
            appAnnouncement: {
              findFirst: jest.fn().mockResolvedValue({
                id: 88,
                title: '春季维护公告',
                content: '今晚 23:00 到次日 01:00 将进行系统维护，请提前保存进度。',
                summary: '今晚 23:00 到次日 01:00 将进行系统维护。',
                announcementType: 2,
                priorityLevel: AnnouncementPriorityEnum.URGENT,
                isPublished: true,
                isPinned: false,
                showAsPopup: true,
                publishStartTime: null,
                publishEndTime: null,
              }),
            },
          },
        },
        schema: {
          appAnnouncement: { id: 'id' },
          appUser: {
            id: 'id',
            isEnabled: 'isEnabled',
            deletedAt: 'deletedAt',
          },
        },
        withErrorHandling: jest.fn(async (callback) => callback()),
      } as any,
      { enqueueNotificationEvents } as any,
    )

    await expect(
      service.createAnnouncement({
        title: '春季维护公告',
        content: '今晚 23:00 到次日 01:00 将进行系统维护，请提前保存进度。',
        announcementType: 2,
        priorityLevel: AnnouncementPriorityEnum.URGENT,
        isPublished: true,
        showAsPopup: true,
        publishStartTime: null,
        publishEndTime: null,
      } as any),
    ).resolves.toBe(true)

    expect(enqueueNotificationEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
        bizKey: 'announcement:notify:88:user:1001',
        payload: expect.objectContaining({
          receiverUserId: 1001,
          type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
          title: '春季维护公告',
          payload: expect.objectContaining({
            announcementId: 88,
            priorityLevel: AnnouncementPriorityEnum.URGENT,
          }),
        }),
      }),
      expect.objectContaining({
        bizKey: 'announcement:notify:88:user:1002',
      }),
    ])
  })

  it('skips normal announcement fanout for content-only notice', async () => {
    const { AppAnnouncementService } = await import('../announcement.service')
    const { AnnouncementPriorityEnum } = await import('../announcement.constant')

    const enqueueNotificationEvents = jest.fn()
    const service = new AppAnnouncementService(
      {
        db: {
          query: {
            appAnnouncement: {
              findFirst: jest.fn().mockResolvedValue({
                id: 66,
                title: '普通活动提示',
                content: '本周话题活动继续开放报名。',
                summary: '本周话题活动继续开放报名。',
                announcementType: 1,
                priorityLevel: AnnouncementPriorityEnum.LOW,
                isPublished: true,
                isPinned: false,
                showAsPopup: false,
                publishStartTime: null,
                publishEndTime: null,
              }),
            },
          },
        },
        schema: {},
      } as any,
      { enqueueNotificationEvents } as any,
    )

    await expect(
      (service as any).tryFanoutImportantAnnouncementNotification(66),
    ).resolves.toBeUndefined()

    expect(enqueueNotificationEvents).not.toHaveBeenCalled()
  })
})
