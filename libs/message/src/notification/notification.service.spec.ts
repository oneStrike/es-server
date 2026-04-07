import { MessageNotificationDispatchStatusEnum, MessageNotificationSubjectTypeEnum, MessageNotificationTypeEnum } from './notification.constant'
import { MessageNotificationService } from './notification.service'

describe('messageNotificationService', () => {
  let service: MessageNotificationService
  let drizzle: any
  let realtimeService: any
  let inboxService: any
  let preferenceService: any
  let templateService: any
  let deleteWhereMock: jest.Mock
  let insertValuesMock: jest.Mock
  let insertReturningMock: jest.Mock
  let transactionMock: jest.Mock

  beforeEach(() => {
    deleteWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    insertReturningMock = jest.fn().mockResolvedValue([
      {
        id: 101,
        userId: 7,
        type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
        actorUserId: null,
        targetType: null,
        targetId: 42,
        subjectType: MessageNotificationSubjectTypeEnum.SYSTEM,
        subjectId: 42,
        title: '新的系统公告',
        content: '新的内容',
        payload: { announcementId: 42 },
        aggregateKey: null,
        aggregateCount: 1,
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-04-07T00:00:00.000Z'),
      },
    ])
    insertValuesMock = jest.fn(() => ({
      returning: insertReturningMock,
    }))
    transactionMock = jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        delete: jest.fn(() => ({
          where: deleteWhereMock,
        })),
        insert: jest.fn(() => ({
          values: insertValuesMock,
        })),
      }
      return callback(tx)
    })

    drizzle = {
      db: {
        delete: jest.fn(() => ({
          where: deleteWhereMock,
        })),
      },
      schema: {
        userNotification: {},
        appUser: {},
      },
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      withTransaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => transactionMock(fn)),
    }

    realtimeService = {
      emitNotificationNew: jest.fn(),
      emitInboxSummaryUpdate: jest.fn(),
    }
    inboxService = {
      getSummary: jest.fn().mockResolvedValue({
        notificationUnreadCount: 1,
        chatUnreadCount: 0,
        totalUnreadCount: 1,
      }),
    }
    preferenceService = {
      getEffectiveNotificationPreference: jest.fn().mockResolvedValue({
        isEnabled: true,
      }),
    }
    templateService = {
      renderNotificationTemplate: jest.fn().mockResolvedValue({
        title: '新的系统公告',
        content: '新的内容',
        templateKey: 'notification.system-announcement',
        usedTemplate: false,
      }),
    }

    service = new MessageNotificationService(
      drizzle,
      realtimeService,
      inboxService,
      preferenceService,
      templateService,
    )
  })

  it('upsert 同步动作会先清理旧通知再插入最新版本', async () => {
    const result = await service.createFromOutbox(
      'announcement:notify:42:user:7',
      {
        receiverUserId: 7,
        type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
        targetId: 42,
        subjectType: MessageNotificationSubjectTypeEnum.SYSTEM,
        subjectId: 42,
        title: '新的系统公告',
        content: '新的内容',
        payload: { announcementId: 42 },
        syncAction: 'UPSERT',
      } as any,
    )

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
    expect(insertValuesMock).toHaveBeenCalledTimes(1)
    expect(realtimeService.emitNotificationNew).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        userId: 7,
        title: '新的系统公告',
      }),
    )
    expect(result).toEqual({
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
      notification: expect.objectContaining({
        id: 101,
      }),
    })
  })

  it('delete 同步动作会绕过偏好检查并删除现有通知', async () => {
    const result = await service.createFromOutbox(
      'announcement:notify:42:user:7',
      {
        receiverUserId: 7,
        type: MessageNotificationTypeEnum.SYSTEM_ANNOUNCEMENT,
        targetId: 42,
        subjectType: MessageNotificationSubjectTypeEnum.SYSTEM,
        subjectId: 42,
        title: '旧公告',
        content: '旧内容',
        syncAction: 'DELETE',
      } as any,
    )

    expect(preferenceService.getEffectiveNotificationPreference).not.toHaveBeenCalled()
    expect(drizzle.db.delete).toHaveBeenCalledTimes(1)
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
    expect(insertValuesMock).not.toHaveBeenCalled()
    expect(realtimeService.emitNotificationNew).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: MessageNotificationDispatchStatusEnum.DELIVERED,
    })
  })
})
