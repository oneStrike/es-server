import * as schema from '@db/schema'
import { BadRequestException } from '@nestjs/common'
import { PgDialect } from 'drizzle-orm/pg-core'
import { AppAnnouncementService } from './announcement.service'

describe('appAnnouncementService', () => {
  const dialect = new PgDialect()

  let service: AppAnnouncementService
  let drizzle: any
  let announcementNotificationFanoutService: any
  let findPaginationMock: jest.Mock
  let appAnnouncementFindFirstMock: jest.Mock
  let appPageFindFirstMock: jest.Mock
  let selectWhereMock: jest.Mock
  let updateSetMock: jest.Mock
  let updateWhereMock: jest.Mock
  let insertValuesMock: jest.Mock
  let insertReturningMock: jest.Mock

  beforeEach(() => {
    findPaginationMock = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 15,
    })
    appAnnouncementFindFirstMock = jest.fn()
    appPageFindFirstMock = jest.fn()
    selectWhereMock = jest.fn().mockResolvedValue([])
    updateWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    updateSetMock = jest.fn(() => ({
      where: updateWhereMock,
    }))
    insertReturningMock = jest.fn().mockResolvedValue([{ id: 42 }])
    insertValuesMock = jest.fn(() => ({
      returning: insertReturningMock,
    }))

    drizzle = {
      db: {
        query: {
          appAnnouncement: {
            findFirst: appAnnouncementFindFirstMock,
          },
          appPage: {
            findFirst: appPageFindFirstMock,
          },
        },
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: selectWhereMock,
          })),
        })),
        update: jest.fn(() => ({
          set: updateSetMock,
        })),
        insert: jest.fn(() => ({
          values: insertValuesMock,
        })),
      },
      ext: {
        findPagination: findPaginationMock,
      },
      schema,
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      assertAffectedRows: jest.fn(),
    }

    announcementNotificationFanoutService = {
      enqueueAnnouncementFanout: jest.fn().mockResolvedValue(undefined),
    }

    service = new AppAnnouncementService(
      drizzle,
      announcementNotificationFanoutService,
    )
  })

  it('publishedOnly 查询会自动收口到当前有效发布时间窗口', async () => {
    await service.findAnnouncementPage(
      {
        pageIndex: 1,
        pageSize: 10,
      } as any,
      {
        publishedOnly: true,
      },
    )

    const where = findPaginationMock.mock.calls[0][1].where
    const rendered = dialect.sqlToQuery(where).sql

    expect(rendered).toContain('"app_announcement"."isPublished" = $1')
    expect(rendered).toContain('"app_announcement"."publishStartTime" is null')
    expect(rendered).toContain('"app_announcement"."publishStartTime" <= $2')
    expect(rendered).toContain('"app_announcement"."publishEndTime" is null')
    expect(rendered).toContain('"app_announcement"."publishEndTime" >= $3')
  })

  it('enablePlatform 不是数字数组时返回 BadRequestException', async () => {
    await expect(
      service.findAnnouncementPage({
        enablePlatform: '{}',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(findPaginationMock).not.toHaveBeenCalled()
  })

  it('更新公告时未传 pageId 不会把现有关联页面清空', async () => {
    appAnnouncementFindFirstMock.mockResolvedValue({
      id: 42,
      pageId: 88,
      publishStartTime: new Date('2026-04-01T00:00:00.000Z'),
      publishEndTime: new Date('2026-04-20T00:00:00.000Z'),
    })

    await service.updateAnnouncement({
      id: 42,
      title: '更新后的标题',
    } as any)

    expect(updateSetMock).toHaveBeenCalledWith({
      title: '更新后的标题',
    })
  })

  it('只更新一侧发布时间时也会基于库内另一侧时间做区间校验', async () => {
    appAnnouncementFindFirstMock.mockResolvedValue({
      id: 42,
      pageId: 88,
      publishStartTime: new Date('2026-04-01T00:00:00.000Z'),
      publishEndTime: new Date('2026-04-05T00:00:00.000Z'),
    })

    await expect(
      service.updateAnnouncement({
        id: 42,
        publishStartTime: new Date('2026-04-06T00:00:00.000Z'),
      } as any),
    ).rejects.toThrow('发布开始时间不能大于或等于结束时间')

    expect(drizzle.db.update).not.toHaveBeenCalled()
  })

  it('创建公告成功后会入队公告 fanout 任务', async () => {
    appPageFindFirstMock.mockResolvedValue({ id: 88 })

    await service.createAnnouncement({
      pageId: 88,
      title: '系统维护公告',
      content: '今晚维护',
    } as any)

    expect(insertValuesMock).toHaveBeenCalled()
    expect(
      announcementNotificationFanoutService.enqueueAnnouncementFanout,
    ).toHaveBeenCalledWith(42)
  })

  it('发布状态变更后只会入队公告 fanout 任务，不直接逐用户发布事件', async () => {
    await service.updateAnnouncementStatus({
      id: 42,
      isPublished: true,
    })

    expect(
      announcementNotificationFanoutService.enqueueAnnouncementFanout,
    ).toHaveBeenCalledWith(42)
  })

  it('删除公告后只会入队公告 fanout 任务，不直接逐用户发布事件', async () => {
    await service.deleteAnnouncement({
      id: 42,
    })

    expect(
      announcementNotificationFanoutService.enqueueAnnouncementFanout,
    ).toHaveBeenCalledWith(42)
  })
})
