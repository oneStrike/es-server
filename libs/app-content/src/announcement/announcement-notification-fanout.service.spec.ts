import type { Db } from '@db/core'
import { BusinessException } from '@libs/platform/exceptions'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'

type AnnouncementDecisionSnapshot = {
  id: number
  isPublished: boolean
  isRealtime: boolean
  publishEndTime?: Date | null
  publishStartTime?: Date | null
}

function createFanoutInsertBuilder(capturedTasks: Array<Record<string, unknown>>) {
  return {
    values: jest.fn((task: Record<string, unknown>) => {
      capturedTasks.push(task)
      return {
        onConflictDoUpdate: jest.fn(async (config) => {
          capturedTasks.push(config.set)
        }),
      }
    }),
  }
}

function createSubject(announcement: AnnouncementDecisionSnapshot | null) {
  const capturedTasks: Array<Record<string, unknown>> = []
  const fanoutTask = {
    announcementId: 'announcementId',
    cursorUserId: 'cursorUserId',
    desiredEventKey: 'desiredEventKey',
    finishedAt: 'finishedAt',
    lastError: 'lastError',
    startedAt: 'startedAt',
    status: 'status',
    updatedAt: 'updatedAt',
  }
  const tx = {
    insert: jest.fn(() => createFanoutInsertBuilder(capturedTasks)),
    query: {
      appAnnouncement: {
        findFirst: jest.fn(async () => announcement),
      },
    },
  }
  const drizzle = {
    db: tx,
    schema: {
      appAnnouncement: {},
      appAnnouncementNotificationFanoutTask: fanoutTask,
      appUser: {},
      userNotification: {},
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
  const service = new AnnouncementNotificationFanoutService(
    drizzle as never,
    {} as never,
  )

  return {
    capturedTasks,
    drizzle,
    service,
    tx: tx as unknown as Db,
  }
}

describe('AnnouncementNotificationFanoutService enqueue decision', () => {
  const activeWindow = {
    publishStartTime: new Date(Date.now() - 60_000),
    publishEndTime: new Date(Date.now() + 60_000),
  }

  it.each([
    [
      'published event for realtime published announcement inside the window',
      {
        id: 1,
        isRealtime: true,
        isPublished: true,
        ...activeWindow,
      },
      'announcement.published',
    ],
    [
      'unpublished event when realtime is disabled',
      {
        id: 1,
        isRealtime: false,
        isPublished: true,
        ...activeWindow,
      },
      'announcement.unpublished',
    ],
    [
      'unpublished event when announcement is not published',
      {
        id: 1,
        isRealtime: true,
        isPublished: false,
        ...activeWindow,
      },
      'announcement.unpublished',
    ],
    [
      'unpublished event before publish start time',
      {
        id: 1,
        isRealtime: true,
        isPublished: true,
        publishStartTime: new Date(Date.now() + 60_000),
        publishEndTime: new Date(Date.now() + 120_000),
      },
      'announcement.unpublished',
    ],
    [
      'unpublished event after publish end time',
      {
        id: 1,
        isRealtime: true,
        isPublished: true,
        publishStartTime: new Date(Date.now() - 120_000),
        publishEndTime: new Date(Date.now() - 60_000),
      },
      'announcement.unpublished',
    ],
  ])('enqueues %s', async (_name, announcement, expectedEventKey) => {
    const { capturedTasks, service, tx } = createSubject(announcement)

    await service.enqueueAnnouncementFanout(announcement.id, tx)

    expect(capturedTasks[0]).toMatchObject({
      announcementId: announcement.id,
      desiredEventKey: expectedEventKey,
      status: 0,
    })
    expect(capturedTasks[1]).toMatchObject({
      desiredEventKey: expectedEventKey,
      status: 0,
    })
  })

  it('does not derive notification eligibility from legacy display fields', async () => {
    const { capturedTasks, service, tx } = createSubject({
      id: 2,
      isRealtime: false,
      isPublished: true,
      ...activeWindow,
      priorityLevel: 3,
      isPinned: true,
      showAsPopup: true,
    } as AnnouncementDecisionSnapshot & {
      isPinned: boolean
      priorityLevel: number
      showAsPopup: boolean
    })

    await service.enqueueAnnouncementFanout(2, tx)

    expect(capturedTasks[0]).toMatchObject({
      announcementId: 2,
      desiredEventKey: 'announcement.unpublished',
    })
  })

  it('keeps resource-not-found semantics when the announcement snapshot is missing', async () => {
    const { service, tx } = createSubject(null)

    await expect(service.enqueueAnnouncementFanout(404, tx)).rejects.toBeInstanceOf(
      BusinessException,
    )
  })
})
