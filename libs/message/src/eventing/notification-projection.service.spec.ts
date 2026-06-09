import { NotificationProjectionService } from './notification-projection.service'

function createSubject(announcement: Record<string, unknown> | null) {
  const deleteReturning = jest.fn(async () => [])
  const deleteWhere = jest.fn(() => ({
    returning: deleteReturning,
  }))
  const db = {
    delete: jest.fn(() => ({
      where: deleteWhere,
    })),
    query: {
      appAnnouncement: {
        findFirst: jest.fn(async () => announcement),
      },
    },
  }
  const templateService = {
    renderNotificationTemplate: jest.fn(async (input) => ({
      actor: null,
      content: input.content,
      fallbackReason: undefined,
      templateId: undefined,
      title: input.title,
      usedTemplate: false,
    })),
  }
  const service = new NotificationProjectionService(
    { db, schema: { userNotification: {} } } as never,
    {} as never,
    templateService as never,
    {} as never,
  )

  return {
    db,
    deleteReturning,
    deleteWhere,
    service,
    templateService,
  }
}

describe('NotificationProjectionService system announcement ordering guard', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('skips stale announcement publish events when the announcement is no longer visible', async () => {
    const { service, templateService } = createSubject({
      enablePlatform: [2],
      isPublished: false,
      isRealtime: true,
    })

    await expect(
      service.applyCommand(
        {
          categoryKey: 'system_announcement',
          content: 'old content',
          mandatory: true,
          mode: 'upsert',
          payload: {
            object: {
              id: 1,
              kind: 'announcement',
            },
          },
          projectionKey: 'announcement:notify:1:user:9',
          receiverUserId: 9,
          title: 'old title',
        },
        {} as never,
        {} as never,
      ),
    ).resolves.toMatchObject({
      action: 'skip',
      reason: 'stale_system_announcement_publish',
    })
    expect(templateService.renderNotificationTemplate).not.toHaveBeenCalled()
  })

  it('skips stale announcement delete events when the announcement is currently visible', async () => {
    const { db, service } = createSubject({
      enablePlatform: [2],
      isPublished: true,
      isRealtime: true,
      publishEndTime: new Date(Date.now() + 60_000),
      publishStartTime: new Date(Date.now() - 60_000),
    })

    await expect(
      service.applyCommand(
        {
          announcementId: 1,
          categoryKey: 'system_announcement',
          mode: 'delete',
          projectionKey: 'announcement:notify:1:user:9',
          receiverUserId: 9,
        },
        {} as never,
        {} as never,
      ),
    ).resolves.toMatchObject({
      action: 'skip',
      reason: 'stale_system_announcement_delete',
    })
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('does not skip announcement delete events at the exact publish end boundary', async () => {
    const now = new Date('2026-05-18T12:00:00.000Z')
    jest.useFakeTimers().setSystemTime(now)
    const { db, deleteWhere, service } = createSubject({
      enablePlatform: [2],
      isPublished: true,
      isRealtime: true,
      publishEndTime: now,
      publishStartTime: new Date('2026-05-18T11:00:00.000Z'),
    })

    await expect(
      service.applyCommand(
        {
          announcementId: 1,
          categoryKey: 'system_announcement',
          mode: 'delete',
          projectionKey: 'announcement:notify:1:user:9',
          receiverUserId: 9,
        },
        {} as never,
        {} as never,
      ),
    ).resolves.toMatchObject({
      action: 'delete',
      projectionKey: 'announcement:notify:1:user:9',
      receiverUserId: 9,
    })
    expect(db.delete).toHaveBeenCalledTimes(1)
    expect(deleteWhere).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
