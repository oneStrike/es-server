/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import { userNotification } from '@db/schema'
import { MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM } from './notification.constant'
import { MessageNotificationService } from './notification.service'
import { sql } from 'drizzle-orm'

describe('MessageNotificationService user notification pagination', () => {
  function createService() {
    const rows = [
      {
        id: 10,
        receiverUserId: 7,
        actorUserId: null,
        categoryKey: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
        title: '系统通知',
        content: '维护完成',
        payload: null,
        isRead: false,
        isHidden: false,
        readAt: null,
        expiresAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]
    const listBuilder: Record<string, jest.Mock> = {}
    listBuilder.from = jest.fn(() => listBuilder)
    listBuilder.where = jest.fn(() => listBuilder)
    listBuilder.orderBy = jest.fn(() => listBuilder)
    listBuilder.limit = jest.fn(() => listBuilder)
    listBuilder.offset = jest.fn(async () => rows)
    const buildPageParams = jest.fn(() => ({
      page: {
        pageIndex: 2,
        pageSize: 10,
        limit: 10,
        offset: 10,
      },
      order: {
        orderBySql: [sql.raw('"created_at" desc')],
      },
      dateRange: {
        gte: new Date('2026-03-31T16:00:00.000Z'),
        lt: new Date('2026-04-01T16:00:00.000Z'),
      },
    }))
    const db = {
      select: jest.fn(() => listBuilder),
      $count: jest.fn(async () => 1),
      query: {
        appUser: {
          findMany: jest.fn(),
        },
      },
    }
    const drizzle = {
      buildPageParams,
      db,
      schema: {
        userNotification,
      },
    } as unknown as DrizzleService
    const service = new MessageNotificationService(
      drizzle,
      {} as never,
      {} as never,
    )

    return {
      service,
      mocks: {
        buildPageParams,
        db,
        listBuilder,
      },
    }
  }

  it('returns ApiPage output and delegates PageDto normalization to buildPageParams', async () => {
    const { service, mocks } = createService()

    const page = await service.queryUserNotificationList(7, {
      pageIndex: 2,
      pageSize: 10,
      orderBy: '{"createdAt":"desc"}',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      isRead: false,
      categoryKeys: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
    })

    expect(mocks.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        pageIndex: 2,
        pageSize: 10,
        orderBy: '{"createdAt":"desc"}',
        startDate: '2026-04-01',
        endDate: '2026-04-01',
      }),
      expect.objectContaining({
        table: userNotification,
        fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        maxPageSize: 100,
      }),
    )
    expect(mocks.listBuilder.orderBy).toHaveBeenCalledWith(expect.anything())
    expect(mocks.listBuilder.limit).toHaveBeenCalledWith(10)
    expect(mocks.listBuilder.offset).toHaveBeenCalledWith(10)
    expect(mocks.db.$count).toHaveBeenCalledWith(
      userNotification,
      expect.anything(),
    )
    expect(mocks.db.query.appUser.findMany).not.toHaveBeenCalled()
    expect(page).toMatchObject({
      pageIndex: 2,
      pageSize: 10,
      total: 1,
      list: [
        {
          id: 10,
          type: MESSAGE_NOTIFICATION_CATEGORY_KEY_ENUM.SYSTEM_ANNOUNCEMENT,
          message: {
            title: '系统通知',
            body: '维护完成',
          },
          actor: null,
          isRead: false,
        },
      ],
    })
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
  })
})
