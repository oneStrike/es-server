import { appAnnouncement } from '@db/schema'
import { AppAnnouncementService } from './announcement.service'

function createUpdateBuilder(updateSets: Array<Record<string, unknown>>) {
  return {
    set: jest.fn((value: Record<string, unknown>) => {
      updateSets.push(value)
      return {
        where: jest.fn(async () => ({ rowCount: 1 })),
      }
    }),
  }
}

function createSubject() {
  const updateSets: Array<Record<string, unknown>> = []
  const tx = {
    update: jest.fn(() => createUpdateBuilder(updateSets)),
  }
  const drizzle = {
    assertAffectedRows: jest.fn(),
    db: {
      query: {
        appAnnouncement: {
          findFirst: jest.fn(async () => ({
            id: 1,
            pageId: null,
            popupBackgroundImage: null,
            popupBackgroundPosition: 'center',
            publishStartTime: null,
            publishEndTime: null,
            showAsPopup: false,
          })),
        },
        appPage: {
          findFirst: jest.fn(),
        },
      },
    },
    schema: {
      appAnnouncement: {
        id: 'id',
      },
      appAnnouncementView: {
        announcementId: 'announcementId',
      },
      appPage: {
        id: 'pageId',
      },
    },
    withTransaction: jest.fn(async (callback) => callback(tx)),
  }
  const fanoutService = {
    enqueueAnnouncementFanout: jest.fn(async () => true),
    retryFailedAnnouncementFanout: jest.fn(async () => true),
  }
  const service = new AppAnnouncementService(
    drizzle as never,
    fanoutService as never,
  )

  return {
    drizzle,
    fanoutService,
    service,
    tx,
    updateSets,
  }
}

describe('AppAnnouncementService fanout write paths', () => {
  it('enqueues fanout after updating isRealtime through the update path', async () => {
    const { drizzle, fanoutService, service, tx, updateSets } = createSubject()

    await service.updateAnnouncement({
      id: 1,
      isRealtime: true,
      title: '实时公告',
    })

    expect(updateSets[0]).toMatchObject({
      isRealtime: true,
      title: '实时公告',
    })
    expect(drizzle.assertAffectedRows).toHaveBeenCalledTimes(1)
    expect(fanoutService.enqueueAnnouncementFanout).toHaveBeenCalledWith(1, tx)
  })

  it('enqueues fanout after changing publish status in the same transaction', async () => {
    const { drizzle, fanoutService, service, tx, updateSets } = createSubject()

    await service.updateAnnouncementStatus({
      id: 1,
      isPublished: true,
    })

    expect(updateSets[0]).toEqual({ isPublished: true })
    expect(drizzle.assertAffectedRows).toHaveBeenCalledTimes(1)
    expect(fanoutService.enqueueAnnouncementFanout).toHaveBeenCalledWith(1, tx)
  })

  it('enqueues fanout after logically unpublishing an announcement', async () => {
    const { drizzle, fanoutService, service, tx, updateSets } = createSubject()

    await service.deleteAnnouncement({ id: 1 })

    expect(updateSets[0]).toEqual({ isPublished: false })
    expect(drizzle.assertAffectedRows).toHaveBeenCalledTimes(1)
    expect(fanoutService.enqueueAnnouncementFanout).toHaveBeenCalledWith(1, tx)
  })

  it('retries the latest failed fanout task without exposing fanout task ids', async () => {
    const { fanoutService, service } = createSubject()

    await service.retryAnnouncementFanout({ id: 1 })

    expect(fanoutService.retryFailedAnnouncementFanout).toHaveBeenCalledWith(1)
  })
})

describe('AppAnnouncementService public announcement contracts', () => {
  it('does not select the content column for the APP public list', () => {
    const service = new AppAnnouncementService(
      {
        schema: {
          appAnnouncement,
        },
      } as never,
      {} as never,
    )

    const select = (
      service as unknown as {
        buildPublicAnnouncementListSelect: () => Record<string, unknown>
      }
    ).buildPublicAnnouncementListSelect()

    expect(select).toHaveProperty('title')
    expect(select).not.toHaveProperty('content')
  })

  it('marks read with CurrentUser only and ignores any body userId', async () => {
    const insertedValues: Array<Record<string, unknown>> = []
    const onConflictDoNothing = jest.fn(async () => undefined)
    const drizzle = {
      db: {
        insert: jest.fn(() => ({
          values: jest.fn((value: Record<string, unknown>) => {
            insertedValues.push(value)
            return { onConflictDoNothing }
          }),
        })),
      },
      schema: {
        appAnnouncement: {},
        appAnnouncementRead: {},
      },
    }
    const service = new AppAnnouncementService(
      drizzle as never,
      {} as never,
    )
    ;(
      service as unknown as {
        findVisiblePublicAnnouncement: () => Promise<Record<string, unknown>>
      }
    ).findVisiblePublicAnnouncement = jest.fn(async () => ({ id: 7 }))

    await service.markAnnouncementRead({ id: 7, userId: 1 } as never, 99)

    expect(insertedValues[0]).toMatchObject({
      announcementId: 7,
      userId: 99,
      readAt: expect.any(Date),
    })
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1)
  })

  it('rejects popup announcements without a background image before writing', async () => {
    const { drizzle, service } = createSubject()

    await expect(
      service.createAnnouncement({
        announcementType: 0,
        content: 'content',
        isPinned: false,
        isRealtime: false,
        priorityLevel: 1,
        showAsPopup: true,
        title: 'popup',
      }),
    ).rejects.toThrow('弹窗公告必须配置背景图片')
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('rejects empty publish platforms before writing', async () => {
    const { drizzle, service } = createSubject()

    await expect(
      service.createAnnouncement({
        announcementType: 0,
        content: 'content',
        enablePlatform: [],
        isPinned: false,
        isRealtime: false,
        priorityLevel: 1,
        showAsPopup: false,
        title: 'platform',
      }),
    ).rejects.toThrow('发布平台不能为空')
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('rejects empty publish platforms on update before writing', async () => {
    const { drizzle, service } = createSubject()

    await expect(
      service.updateAnnouncement({
        id: 1,
        enablePlatform: [],
      }),
    ).rejects.toThrow('发布平台不能为空')
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('increments view count only after inserting the current user view record', async () => {
    const updateSets: Array<Record<string, unknown>> = []
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(async () => [{ announcementId: 7 }]),
          })),
        })),
      })),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [{ id: 7 }]),
          })),
        })),
      })),
      update: jest.fn(() => createUpdateBuilder(updateSets)),
    }
    const drizzle = {
      assertAffectedRows: jest.fn(),
      schema: {
        appAnnouncement: {
          id: 'id',
          viewCount: 'viewCount',
        },
        appAnnouncementView: {
          announcementId: 'announcementId',
        },
      },
      withTransaction: jest.fn(async (callback) => callback(tx)),
    }
    const service = new AppAnnouncementService(drizzle as never, {} as never)
    ;(
      service as unknown as {
        buildAppVisibilityConditions: () => unknown[]
      }
    ).buildAppVisibilityConditions = jest.fn(() => [])

    await service.incrementPublicAnnouncementViewCount({ id: 7 }, 99)

    expect(tx.insert).toHaveBeenCalledTimes(1)
    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(updateSets[0]).toHaveProperty('viewCount')
    expect(drizzle.assertAffectedRows).toHaveBeenCalledTimes(1)
  })

  it('does not increment view count when the current user view already exists', async () => {
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn(async () => []),
          })),
        })),
      })),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => [{ id: 7 }]),
          })),
        })),
      })),
      update: jest.fn(),
    }
    const drizzle = {
      assertAffectedRows: jest.fn(),
      schema: {
        appAnnouncement: {
          id: 'id',
        },
        appAnnouncementView: {
          announcementId: 'announcementId',
        },
      },
      withTransaction: jest.fn(async (callback) => callback(tx)),
    }
    const service = new AppAnnouncementService(drizzle as never, {} as never)
    ;(
      service as unknown as {
        buildAppVisibilityConditions: () => unknown[]
      }
    ).buildAppVisibilityConditions = jest.fn(() => [])

    await service.incrementPublicAnnouncementViewCount({ id: 7 }, 99)

    expect(tx.insert).toHaveBeenCalledTimes(1)
    expect(tx.update).not.toHaveBeenCalled()
    expect(drizzle.assertAffectedRows).not.toHaveBeenCalled()
  })
})
