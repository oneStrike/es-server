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
            publishStartTime: null,
            publishEndTime: null,
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
      appPage: {
        id: 'pageId',
      },
    },
    withTransaction: jest.fn(async (callback) => callback(tx)),
  }
  const fanoutService = {
    enqueueAnnouncementFanout: jest.fn(async () => true),
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
})
