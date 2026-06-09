import type { Db } from '@db/core'
import { BusinessException } from '@libs/platform/exceptions'
import { AnnouncementNotificationFanoutService } from './announcement-notification-fanout.service'

type AnnouncementDecisionSnapshot = {
  enablePlatform?: number[] | null
  id: number
  isPublished: boolean
  isRealtime: boolean
  publishEndTime?: Date | null
  publishStartTime?: Date | null
  updatedAt?: Date | null
}

function createFanoutInsertBuilder(capturedTasks: Array<Record<string, unknown>>) {
  return {
    values: jest.fn((task: Record<string, unknown>) => {
      const insertedTask = {
        id: capturedTasks.length + 1,
        ...task,
        createdAt: new Date(),
      }
      capturedTasks.push(insertedTask)
      return {
        onConflictDoNothing: jest.fn(() => ({
          returning: jest.fn(async () => [insertedTask]),
        })),
      }
    }),
  }
}

function createSubject(announcement: AnnouncementDecisionSnapshot | null) {
  const capturedTasks: Array<Record<string, unknown>> = []
  const updateSets: Array<Record<string, unknown>> = []
  const fanoutTask = {
    announcementId: 'announcementId',
    attemptCount: 'attemptCount',
    cursorUserId: 'cursorUserId',
    desiredEventKey: 'desiredEventKey',
    eventBoundaryKey: 'eventBoundaryKey',
    fanoutKey: 'fanoutKey',
    finishedAt: 'finishedAt',
    id: 'id',
    lastError: 'lastError',
    nextAttemptAt: 'nextAttemptAt',
    processingLeaseExpiresAt: 'processingLeaseExpiresAt',
    startedAt: 'startedAt',
    status: 'status',
    updatedAt: 'updatedAt',
  }
  const appAnnouncement = {
    id: 'announcementId',
    notificationEndBoundaryAt: 'notificationEndBoundaryAt',
    notificationFanoutDesiredEventKey: 'notificationFanoutDesiredEventKey',
    notificationFanoutLastError: 'notificationFanoutLastError',
    notificationFanoutStatus: 'notificationFanoutStatus',
    notificationFanoutTaskId: 'notificationFanoutTaskId',
    notificationFanoutUpdatedAt: 'notificationFanoutUpdatedAt',
    notificationStartBoundaryAt: 'notificationStartBoundaryAt',
  }
  const tx = {
    insert: jest.fn(() => createFanoutInsertBuilder(capturedTasks)),
    query: {
      appAnnouncement: {
        findFirst: jest.fn(async () => announcement),
      },
    },
    update: jest.fn(() => ({
      set: jest.fn((value: Record<string, unknown>) => {
        updateSets.push(value)
        return {
          where: jest.fn(() => ({
            returning: jest.fn(async () => [
              {
                announcementId: 1,
                cursorUserId: value.cursorUserId ?? null,
                desiredEventKey: 'announcement.published',
                id: 1,
                lastError: value.lastError ?? null,
                status: value.status ?? 0,
                updatedAt: value.updatedAt ?? new Date(),
              },
            ]),
          })),
        }
      }),
    })),
  }
  const drizzle = {
    db: tx,
    schema: {
      appAnnouncement,
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
    updateSets,
  }
}

describe('AnnouncementNotificationFanoutService enqueue decision', () => {
  const activeWindow = {
    enablePlatform: [2],
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
        enablePlatform: [2],
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
        enablePlatform: [2],
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
      attemptCount: 0,
      desiredEventKey: expectedEventKey,
      eventBoundaryKey: expect.stringMatching(/^manual:/),
      fanoutKey: expect.stringContaining(
        `announcement:${announcement.id}:${expectedEventKey}:manual:`,
      ),
      processingLeaseExpiresAt: null,
      nextAttemptAt: null,
      status: 0,
    })
  })

  it('does not fan out announcements that are not visible on APP', async () => {
    const { capturedTasks, service, tx } = createSubject({
      id: 3,
      enablePlatform: [1, 3],
      isPublished: true,
      isRealtime: true,
      publishEndTime: new Date(Date.now() + 60_000),
      publishStartTime: new Date(Date.now() - 60_000),
    })

    await service.enqueueAnnouncementFanout(3, tx)

    expect(capturedTasks[0]).toMatchObject({
      announcementId: 3,
      desiredEventKey: 'announcement.unpublished',
    })
  })

  it('allows publish and withdraw tasks to coexist through distinct fanout keys', async () => {
    const announcement = {
      id: 10,
      isRealtime: true,
      isPublished: true,
      updatedAt: new Date('2026-05-18T12:00:00.000Z'),
      ...activeWindow,
    }
    const { capturedTasks, service, tx } = createSubject(announcement)

    await service.enqueueAnnouncementFanout(10, tx)
    announcement.isPublished = false
    await service.enqueueAnnouncementFanout(10, tx)

    expect(capturedTasks.map((task) => task.desiredEventKey)).toEqual([
      'announcement.published',
      'announcement.unpublished',
    ])
    expect(new Set(capturedTasks.map((task) => task.fanoutKey)).size).toBe(2)
  })

  it('enqueues lifecycle start and end boundaries explicitly', async () => {
    const { service } = createSubject(null)
    const enqueueLifecycleStartFanoutTask = jest.fn()
    const enqueueLifecycleEndFanoutTask = jest.fn()
    const now = new Date('2026-05-18T12:00:00.000Z')
    const start = new Date('2026-05-18T12:00:00.000Z')
    const end = new Date('2026-05-18T13:00:00.000Z')
    const serviceInternals = service as unknown as {
      enqueueLifecycleEndFanoutTask: typeof enqueueLifecycleEndFanoutTask
      enqueueLifecycleStartFanoutTask: typeof enqueueLifecycleStartFanoutTask
      loadLifecycleActiveAnnouncements: () => Promise<unknown[]>
      loadLifecycleExpiredAnnouncements: () => Promise<unknown[]>
    }
    serviceInternals.enqueueLifecycleStartFanoutTask =
      enqueueLifecycleStartFanoutTask
    serviceInternals.enqueueLifecycleEndFanoutTask = enqueueLifecycleEndFanoutTask
    serviceInternals.loadLifecycleActiveAnnouncements = jest.fn(async () => [
      { id: 1, publishStartTime: start },
    ])
    serviceInternals.loadLifecycleExpiredAnnouncements = jest.fn(async () => [
      { id: 2, publishEndTime: end },
    ])

    await expect(service.enqueueDueLifecycleFanoutTasks(now)).resolves.toBe(2)
    expect(enqueueLifecycleStartFanoutTask).toHaveBeenCalledWith({
      id: 1,
      publishStartTime: start,
    })
    expect(enqueueLifecycleEndFanoutTask).toHaveBeenCalledWith({
      id: 2,
      publishEndTime: end,
    })
  })

  it('includes event kind and lifecycle boundary in domain event idempotency keys', () => {
    const { service } = createSubject(null)
    const serviceInternals = service as unknown as {
      buildDomainEventIdempotencyKey: (input: {
        announcementId: number
        eventBoundaryKey: string
        eventKey: string
        receiverUserId: number
      }) => string
    }

    expect(
      serviceInternals.buildDomainEventIdempotencyKey({
        announcementId: 1,
        receiverUserId: 8,
        eventKey: 'announcement.published',
        eventBoundaryKey: 'start:2026-05-18T12:00:00.000Z',
      }),
    ).toBe(
      'announcement:1:user:8:announcement.published:start:2026-05-18T12:00:00.000Z',
    )
  })

  it('marks stale publish tasks as succeeded without sending notifications', async () => {
    const { service } = createSubject(null)
    const leaseExpiresAt = new Date(Date.now() + 60_000)
    const markTaskSucceeded = jest.fn()
    const loadAnnouncementPayloadSnapshot = jest.fn()
    const serviceInternals = service as unknown as {
      loadAnnouncementDecisionSnapshot: () => Promise<AnnouncementDecisionSnapshot>
      loadAnnouncementPayloadSnapshot: typeof loadAnnouncementPayloadSnapshot
      markTaskSucceeded: typeof markTaskSucceeded
      processTask: (task: Record<string, unknown>) => Promise<void>
    }
    serviceInternals.loadAnnouncementDecisionSnapshot = jest.fn(async () => ({
      id: 1,
      enablePlatform: [2],
      isPublished: false,
      isRealtime: true,
    }))
    serviceInternals.loadAnnouncementPayloadSnapshot =
      loadAnnouncementPayloadSnapshot
    serviceInternals.markTaskSucceeded = markTaskSucceeded

    await serviceInternals.processTask({
      announcementId: 1,
      cursorUserId: null,
      desiredEventKey: 'announcement.published',
      eventBoundaryKey: 'manual:old',
      id: 100,
      processingLeaseExpiresAt: leaseExpiresAt,
    })

    expect(markTaskSucceeded).toHaveBeenCalledTimes(1)
    expect(loadAnnouncementPayloadSnapshot).not.toHaveBeenCalled()
  })

  it('marks obsolete same-direction manual boundary tasks as succeeded', async () => {
    const { service } = createSubject(null)
    const leaseExpiresAt = new Date(Date.now() + 60_000)
    const markTaskSucceeded = jest.fn()
    const loadAnnouncementPayloadSnapshot = jest.fn()
    const serviceInternals = service as unknown as {
      loadAnnouncementDecisionSnapshot: () => Promise<AnnouncementDecisionSnapshot>
      loadAnnouncementPayloadSnapshot: typeof loadAnnouncementPayloadSnapshot
      markTaskSucceeded: typeof markTaskSucceeded
      processTask: (task: Record<string, unknown>) => Promise<void>
    }
    serviceInternals.loadAnnouncementDecisionSnapshot = jest.fn(async () => ({
      id: 1,
      enablePlatform: [2],
      isPublished: true,
      isRealtime: true,
      publishEndTime: new Date(Date.now() + 60_000),
      publishStartTime: new Date(Date.now() - 60_000),
      updatedAt: new Date('2026-05-18T12:01:00.000Z'),
    }))
    serviceInternals.loadAnnouncementPayloadSnapshot =
      loadAnnouncementPayloadSnapshot
    serviceInternals.markTaskSucceeded = markTaskSucceeded

    await serviceInternals.processTask({
      announcementId: 1,
      cursorUserId: null,
      desiredEventKey: 'announcement.published',
      eventBoundaryKey: 'manual:2026-05-18T12:00:00.000Z',
      id: 100,
      processingLeaseExpiresAt: leaseExpiresAt,
    })

    expect(markTaskSucceeded).toHaveBeenCalledTimes(1)
    expect(loadAnnouncementPayloadSnapshot).not.toHaveBeenCalled()
  })

  it('prevents overlapping local drains', async () => {
    const { service } = createSubject(null)
    const leaseExpiresAt = new Date(Date.now() + 60_000)
    let releaseProcessing!: () => void
    const processingReleased = new Promise<void>((resolve) => {
      releaseProcessing = resolve
    })
    const processingStarted = new Promise<void>((resolve) => {
      const serviceInternals = service as unknown as {
        claimNextRunnableTask: () => Promise<Record<string, unknown>>
        processTask: () => Promise<void>
      }
      serviceInternals.claimNextRunnableTask = jest.fn(async () => ({
        announcementId: 1,
        cursorUserId: null,
        desiredEventKey: 'announcement.published',
        eventBoundaryKey: 'manual:2026-05-18T12:00:00.000Z',
        id: 1,
        processingLeaseExpiresAt: leaseExpiresAt,
      }))
      serviceInternals.processTask = jest.fn(async () => {
        resolve()
        await processingReleased
      })
    })
    const serviceInternals = service as unknown as {
      claimNextRunnableTask: jest.Mock
      processTask: jest.Mock
    }

    const firstDrain = service.consumePendingTasks({ maxTasks: 1 })
    await processingStarted
    const secondDrain = await service.consumePendingTasks({ maxTasks: 1 })
    releaseProcessing()

    await expect(firstDrain).resolves.toBe(1)
    expect(secondDrain).toBe(0)
    expect(serviceInternals.claimNextRunnableTask).toHaveBeenCalledTimes(1)
    expect(serviceInternals.processTask).toHaveBeenCalledTimes(1)
  })

  it('stops each drain after the configured task budget', async () => {
    const { service } = createSubject(null)
    const serviceInternals = service as unknown as {
      claimNextRunnableTask: jest.Mock
      processTask: jest.Mock
    }
    serviceInternals.claimNextRunnableTask = jest.fn(async () => ({
      announcementId: 1,
      cursorUserId: null,
      desiredEventKey: 'announcement.published',
      eventBoundaryKey: 'manual:2026-05-18T12:00:00.000Z',
      id: 1,
      processingLeaseExpiresAt: new Date(Date.now() + 60_000),
    }))
    serviceInternals.processTask = jest.fn(async () => undefined)

    await expect(service.consumePendingTasks({ maxTasks: 1 })).resolves.toBe(1)

    expect(serviceInternals.claimNextRunnableTask).toHaveBeenCalledTimes(1)
    expect(serviceInternals.processTask).toHaveBeenCalledTimes(1)
  })

  it('pauses a task with its cursor when the batch budget is exhausted', async () => {
    const { service } = createSubject(null)
    const leaseExpiresAt = new Date(Date.now() + 60_000)
    const publishMany = jest.fn(async () => undefined)
    const pauseTaskForNextTick = jest.fn()
    const advanceTaskCursor = jest.fn()
    const markTaskSucceeded = jest.fn()
    const serviceInternals = service as unknown as {
      advanceTaskCursor: typeof advanceTaskCursor
      loadAnnouncementDecisionSnapshot: () => Promise<AnnouncementDecisionSnapshot>
      loadAnnouncementPayloadSnapshot: () => Promise<Record<string, unknown>>
      loadPublishedReceiverUserIds: () => Promise<number[]>
      markTaskSucceeded: typeof markTaskSucceeded
      messageDomainEventPublisher: { publishMany: typeof publishMany }
      pauseTaskForNextTick: typeof pauseTaskForNextTick
      processTask: (
        task: Record<string, unknown>,
        budget: {
          maxBatchesPerTask: number
          maxRuntimeMs: number
          nowMs: () => number
          startedAtMs: number
        },
      ) => Promise<void>
    }
    serviceInternals.messageDomainEventPublisher = { publishMany }
    serviceInternals.loadAnnouncementDecisionSnapshot = jest.fn(async () => ({
      id: 1,
      enablePlatform: [2],
      isPublished: true,
      isRealtime: true,
      publishEndTime: new Date(Date.now() + 60_000),
      publishStartTime: new Date(Date.now() - 60_000),
      updatedAt: new Date('2026-05-18T12:00:00.000Z'),
    }))
    serviceInternals.loadAnnouncementPayloadSnapshot = jest.fn(async () => ({
      announcementType: 1,
      content: 'content',
      priorityLevel: 1,
      summary: 'summary',
      title: 'title',
    }))
    serviceInternals.loadPublishedReceiverUserIds = jest.fn(async () => [8, 9])
    serviceInternals.pauseTaskForNextTick = pauseTaskForNextTick
    serviceInternals.advanceTaskCursor = advanceTaskCursor
    serviceInternals.markTaskSucceeded = markTaskSucceeded

    const task = {
      announcementId: 1,
      cursorUserId: null,
      desiredEventKey: 'announcement.published',
      eventBoundaryKey: 'manual:2026-05-18T12:00:00.000Z',
      id: 100,
      processingLeaseExpiresAt: leaseExpiresAt,
    }
    await serviceInternals.processTask(task, {
      maxBatchesPerTask: 1,
      maxRuntimeMs: Number.POSITIVE_INFINITY,
      nowMs: () => 0,
      startedAtMs: 0,
    })

    expect(publishMany).toHaveBeenCalledTimes(1)
    expect(pauseTaskForNextTick).toHaveBeenCalledWith(task, leaseExpiresAt, 9)
    expect(advanceTaskCursor).not.toHaveBeenCalled()
    expect(markTaskSucceeded).not.toHaveBeenCalled()
  })

  it('releases the processing lease without spending retry attempts on budget pauses', async () => {
    const { service, updateSets } = createSubject(null)
    const leaseExpiresAt = new Date(Date.now() + 60_000)
    const serviceInternals = service as unknown as {
      pauseTaskForNextTick: (
        task: Record<string, unknown>,
        leaseExpiresAt: Date,
        cursorUserId: number,
      ) => Promise<void>
    }

    await serviceInternals.pauseTaskForNextTick(
      {
        announcementId: 1,
        cursorUserId: null,
        desiredEventKey: 'announcement.published',
        eventBoundaryKey: 'manual:2026-05-18T12:00:00.000Z',
        id: 100,
        processingLeaseExpiresAt: leaseExpiresAt,
      },
      leaseExpiresAt,
      9,
    )

    expect(updateSets[0]).toMatchObject({
      cursorUserId: 9,
      processingLeaseExpiresAt: null,
      status: 0,
    })
    expect(updateSets[0]).not.toHaveProperty('attemptCount')
    expect(updateSets[0]).not.toHaveProperty('lastError')
  })

  it('keeps announcement business updatedAt stable when syncing fanout runtime state', () => {
    const { service } = createSubject(null)
    const serviceInternals = service as unknown as {
      buildAnnouncementFanoutRuntimeSet: (
        task: Record<string, unknown>,
      ) => Record<string, unknown>
    }

    const updateSet = serviceInternals.buildAnnouncementFanoutRuntimeSet({
      desiredEventKey: 'announcement.published',
      id: 12,
      lastError: null,
      status: 0,
      updatedAt: new Date('2026-05-18T12:00:00.000Z'),
    })

    expect(updateSet).toMatchObject({
      notificationFanoutDesiredEventKey: 'announcement.published',
      notificationFanoutLastError: null,
      notificationFanoutStatus: 0,
      notificationFanoutTaskId: 12,
    })
    expect(updateSet.updatedAt).toBeDefined()
  })

  it('backs off failed retries and stops retrying after the max attempt', () => {
    const { service } = createSubject(null)
    const now = new Date('2026-05-18T12:00:00.000Z')
    const serviceInternals = service as unknown as {
      buildNextAttemptAt: (attemptCount: number, now: Date) => Date | null
    }

    expect(serviceInternals.buildNextAttemptAt(1, now)?.getTime()).toBeGreaterThan(
      now.getTime(),
    )
    expect(serviceInternals.buildNextAttemptAt(5, now)).toBeNull()
  })

  it('resets the latest failed fanout task for operator retry', async () => {
    const updateSets: Array<Record<string, unknown>> = []
    const fanoutTask = {
      announcementId: 'announcementId',
      attemptCount: 'attemptCount',
      cursorUserId: 'cursorUserId',
      desiredEventKey: 'desiredEventKey',
      finishedAt: 'finishedAt',
      id: 'id',
      lastError: 'lastError',
      nextAttemptAt: 'nextAttemptAt',
      processingLeaseExpiresAt: 'processingLeaseExpiresAt',
      startedAt: 'startedAt',
      status: 'status',
      updatedAt: 'updatedAt',
    }
    const appAnnouncement = {
      id: 'announcementId',
      notificationFanoutDesiredEventKey: 'notificationFanoutDesiredEventKey',
      notificationFanoutLastError: 'notificationFanoutLastError',
      notificationFanoutStatus: 'notificationFanoutStatus',
      notificationFanoutTaskId: 'notificationFanoutTaskId',
      notificationFanoutUpdatedAt: 'notificationFanoutUpdatedAt',
    }
    const retriedTask = {
      announcementId: 1,
      cursorUserId: null,
      desiredEventKey: 'announcement.published',
      id: 12,
      lastError: null,
      status: 0,
      updatedAt: new Date('2026-05-18T12:00:00.000Z'),
    }
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(async () => [{ id: 12, status: 3 }]),
            })),
          })),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn((value: Record<string, unknown>) => {
          updateSets.push(value)
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => [retriedTask]),
            })),
          }
        }),
      })),
    }
    const drizzle = {
      assertAffectedRows: jest.fn(),
      db,
      schema: {
        appAnnouncement,
        appAnnouncementNotificationFanoutTask: fanoutTask,
        appUser: {},
        userNotification: {},
      },
    }
    const service = new AnnouncementNotificationFanoutService(
      drizzle as never,
      {} as never,
    )

    await service.retryFailedAnnouncementFanout(1)

    expect(updateSets[0]).toMatchObject({
      attemptCount: 0,
      cursorUserId: null,
      finishedAt: null,
      lastError: null,
      nextAttemptAt: null,
      processingLeaseExpiresAt: null,
      startedAt: null,
      status: 0,
    })
    expect(drizzle.assertAffectedRows).toHaveBeenCalledTimes(1)
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
