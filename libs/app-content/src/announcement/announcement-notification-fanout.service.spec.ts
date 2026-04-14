import * as schema from '@db/schema'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'
import { AnnouncementPriorityEnum } from './announcement.constant'

describe('AnnouncementNotificationFanoutService', () => {
  function createService() {
    const insertValuesMock = jest.fn(() => ({
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
    }))
    const pendingTask = {
      id: 1,
      announcementId: 42,
      desiredEventKey: 'announcement.published',
      status: 0,
      cursorUserId: null,
      lastError: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    }
    const processingTask = {
      ...pendingTask,
      status: 1,
      startedAt: new Date('2026-04-13T00:00:00.000Z'),
    }
    let selectCall = 0
    const selectFromMock = jest.fn(() => {
      selectCall += 1
      return {
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue(
              selectCall === 1
                ? [pendingTask]
                : selectCall === 2
                  ? [{ id: 7 }, { id: 9 }]
                  : [],
            ),
          })),
        })),
      }
    })
    let updateCall = 0
    const updateWhereMock = jest.fn(() => {
      updateCall += 1
      if (updateCall === 1) {
        return {
          returning: jest.fn().mockResolvedValue([processingTask]),
        }
      }
      return Promise.resolve({ rowCount: 1 })
    })

    const drizzle = {
      db: {
        query: {
          appAnnouncement: {
            findFirst: jest
              .fn()
              .mockResolvedValue({
                id: 42,
                title: '系统维护公告',
                content: '今晚维护',
                summary: '今晚维护',
                announcementType: 2,
                priorityLevel: AnnouncementPriorityEnum.HIGH,
                isPublished: true,
                isPinned: false,
                showAsPopup: false,
                publishStartTime: new Date('2026-04-01T00:00:00.000Z'),
                publishEndTime: new Date('2026-04-20T00:00:00.000Z'),
              }),
          },
        },
        insert: jest.fn(() => ({
          values: insertValuesMock,
        })),
        select: jest.fn(() => ({
          from: selectFromMock,
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: updateWhereMock,
          })),
        })),
      },
      schema,
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }

    const messageDomainEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    }

    const service = new AnnouncementNotificationFanoutService(
      drizzle as never,
      messageDomainEventPublisher as never,
    )

    return {
      service,
      insertValuesMock,
      messageDomainEventPublisher,
    }
  }

  it('enqueueAnnouncementFanout 会写入 pending fanout 任务', async () => {
    const { service, insertValuesMock } = createService()

    await service.enqueueAnnouncementFanout(42)

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        announcementId: 42,
        desiredEventKey: 'announcement.published',
        status: 0,
      }),
    )
  })

  it('consumePendingTasks 会按接收用户顺序发布公告通知事件', async () => {
    const { service, messageDomainEventPublisher } = createService()

    await service.consumePendingTasks()

    expect(messageDomainEventPublisher.publish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventKey: 'announcement.published',
        context: expect.objectContaining({
          receiverUserId: 7,
          projectionKey: 'announcement:notify:42:user:7',
        }),
      }),
    )
    expect(messageDomainEventPublisher.publish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventKey: 'announcement.published',
        context: expect.objectContaining({
          receiverUserId: 9,
          projectionKey: 'announcement:notify:42:user:9',
        }),
      }),
    )
  })
})
