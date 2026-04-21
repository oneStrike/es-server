import type { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import {
  AnnouncementPriorityEnum,
  AnnouncementTypeEnum,
} from './announcement.constant'
import { AppAnnouncementService } from './announcement.service'

function createAnnouncementService() {
  const appAnnouncementFindFirst = jest.fn()
  const appPageFindFirst = jest.fn()
  const tx = {
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([{ id: 101 }]),
      })),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn().mockResolvedValue({ rowCount: 1 }),
      })),
    })),
  }
  const withTransaction = jest.fn(async (fn: (db: typeof tx) => unknown) =>
    fn(tx),
  )

  const drizzle = {
    db: {
      query: {
        appAnnouncement: {
          findFirst: appAnnouncementFindFirst,
        },
        appPage: {
          findFirst: appPageFindFirst,
        },
      },
    },
    withTransaction,
    ext: {
      findPagination: jest.fn(),
    },
    assertAffectedRows: jest.fn((result: { rowCount?: number }, message: string) => {
      if ((result.rowCount ?? 0) === 0) {
        throw { code: BusinessErrorCode.RESOURCE_NOT_FOUND, message }
      }
    }),
    assertNotEmpty: jest.fn(<T>(arr: T[], message: string) => {
      if (arr.length === 0) {
        throw { code: BusinessErrorCode.RESOURCE_NOT_FOUND, message }
      }
      return arr
    }),
    schema: {
      appAnnouncement: {
        id: 'id',
        title: 'title',
        announcementType: 'announcementType',
        priorityLevel: 'priorityLevel',
        isPublished: 'isPublished',
        publishStartTime: 'publishStartTime',
        publishEndTime: 'publishEndTime',
        isPinned: 'isPinned',
        showAsPopup: 'showAsPopup',
        pageId: 'pageId',
        enablePlatform: 'enablePlatform',
        viewCount: 'viewCount',
      },
      appPage: {
        id: 'id',
      },
    },
  } as unknown as DrizzleService

  const fanoutService = {
    enqueueAnnouncementFanout: jest.fn().mockResolvedValue(true),
  }

  return {
    service: new AppAnnouncementService(drizzle, fanoutService as never),
    mocks: {
      appAnnouncementFindFirst,
      appPageFindFirst,
      fanoutService,
      tx,
      withTransaction,
    },
  }
}

describe('AppAnnouncementService', () => {
  it('throws business exception when announcement detail does not exist', async () => {
    const { service, mocks } = createAnnouncementService()
    mocks.appAnnouncementFindFirst.mockResolvedValue(undefined)

    await expect(service.findAnnouncementDetail({ id: 1 })).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '公告不存在',
    })
  })

  it('rejects platform filters outside EnablePlatformEnum', async () => {
    const { service } = createAnnouncementService()

    await expect(
      service.findAnnouncementPage({
        pageIndex: 1,
        pageSize: 20,
        enablePlatform: '[99]',
      }),
    ).rejects.toMatchObject({
      message: '启用平台筛选必须是平台枚举值数组',
    })
  })

  it('creates announcements and enqueues fanout inside the same transaction', async () => {
    const { service, mocks } = createAnnouncementService()

    await service.createAnnouncement({
      title: '系统维护公告',
      content: '系统将于今晚维护',
      announcementType: AnnouncementTypeEnum.PLATFORM,
      priorityLevel: AnnouncementPriorityEnum.MEDIUM,
      isPinned: false,
      showAsPopup: false,
    })

    expect(mocks.withTransaction).toHaveBeenCalled()
    expect(mocks.fanoutService.enqueueAnnouncementFanout).toHaveBeenCalledWith(
      101,
      mocks.tx,
    )
  })

  it('updates publish status and enqueues fanout inside the same transaction', async () => {
    const { service, mocks } = createAnnouncementService()

    await service.updateAnnouncementStatus({
      id: 9,
      isPublished: true,
    })

    expect(mocks.withTransaction).toHaveBeenCalled()
    expect(mocks.fanoutService.enqueueAnnouncementFanout).toHaveBeenCalledWith(
      9,
      mocks.tx,
    )
  })
})
