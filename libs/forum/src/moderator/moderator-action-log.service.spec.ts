/// <reference types="jest" />

import {
  ForumModeratorActionTargetTypeEnum,
  ForumModeratorActionTypeEnum,
} from './moderator-action-log.constant'
import { ForumModeratorActionLogService } from './moderator-action-log.service'

function createThenableBuilder<TResult>(
  result: TResult,
  recorder: Record<string, ReturnType<typeof jest.fn>> = {},
) {
  const promise = Promise.resolve(result)
  const builder: Record<string, ReturnType<typeof jest.fn>> & {
    then: Promise<TResult>['then']
    catch: Promise<TResult>['catch']
    finally: Promise<TResult>['finally']
  } = {
    from: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    values: jest.fn(() => builder),
    where: jest.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  Object.assign(recorder, builder)
  return builder
}

function createSelectBuilder<TResult>(
  result: TResult,
  recorder: Record<string, ReturnType<typeof jest.fn>> = {},
) {
  const promise = Promise.resolve(result)
  const builder: Record<string, ReturnType<typeof jest.fn>> = {
    from: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    offset: jest.fn(async () => result),
    orderBy: jest.fn(() => builder),
    where: jest.fn(() => builder),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  Object.assign(recorder, builder)
  return builder
}

function createActionLogService() {
  const rows = [
    {
      actionDescription: '隐藏评论',
      actionType: ForumModeratorActionTypeEnum.HIDE_COMMENT,
      afterData: '{"isHidden":true}',
      beforeData: '{"isHidden":false}',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      id: 1,
      moderatorId: 5,
      actorType: 1,
      actorUserId: 100,
      targetId: 21,
      targetType: ForumModeratorActionTargetTypeEnum.COMMENT,
    },
    {
      actionDescription: '恢复主题',
      actionType: ForumModeratorActionTypeEnum.RESTORE_TOPIC,
      afterData: '{"deletedAt":null}',
      beforeData: '{"deletedAt":"2026-01-01T00:00:00.000Z"}',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      id: 2,
      moderatorId: null,
      actorType: 2,
      actorUserId: 9001,
      targetId: 22,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
    },
  ]
  const selectRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
  const projectRows = (selection?: Record<string, unknown>) => {
    if (!selection) {
      return rows
    }
    return rows.map((row) =>
      Object.fromEntries(
        Object.keys(selection).map((key) => [
          key,
          row[key as keyof (typeof rows)[number]],
        ]),
      ),
    )
  }
  const drizzle = {
    db: {
      insert: jest.fn(() => createThenableBuilder([{ id: 1 }])),
      select: jest.fn((selection?: Record<string, unknown>) =>
        createSelectBuilder(projectRows(selection), selectRecorder),
      ),
      $count: jest.fn(async () => 1),
    },
    schema: {
      forumModeratorActionLog: {
        actionDescription: 'actionDescription',
        actionType: 'actionType',
        actorType: 'actorType',
        actorUserId: 'actorUserId',
        createdAt: 'createdAt',
        id: 'id',
        moderatorId: 'moderatorId',
        targetId: 'targetId',
        targetType: 'targetType',
        beforeData: 'beforeData',
        afterData: 'afterData',
      },
    },
    buildOrderBy: jest.fn(() => ({ orderBySql: ['createdAtDesc'] })),
    buildPage: jest.fn(() => ({
      limit: 15,
      offset: 0,
      pageIndex: 1,
      pageSize: 15,
    })),
    buildPageParams: jest.fn(() => ({
      page: {
        limit: 15,
        offset: 0,
        pageIndex: 1,
        pageSize: 15,
      },
      order: {
        orderBySql: ['createdAtDesc'],
      },
      dateRange: undefined,
    })),
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
  const service = new ForumModeratorActionLogService(drizzle as any)

  return { drizzle, selectRecorder, service }
}

describe('ForumModeratorActionLogService query', () => {
  it('forces app self-audit queries to the current moderator and strips snapshots', async () => {
    const { drizzle, selectRecorder, service } = createActionLogService()
    const buildQueryWhereSpy = jest.spyOn(
      service as unknown as {
        buildQueryWhere: (query: { moderatorId?: number }) => unknown
      },
      'buildQueryWhere',
    )

    const page = await service.getAppActionLogPage(5, {
      actionType: ForumModeratorActionTypeEnum.HIDE_COMMENT,
      moderatorId: 999,
      targetType: ForumModeratorActionTargetTypeEnum.COMMENT,
    } as any)

    expect(buildQueryWhereSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        moderatorId: 5,
      }),
      null,
    )
    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        moderatorId: 5,
      }),
      expect.any(Object),
    )
    expect(drizzle.buildOrderBy).not.toHaveBeenCalled()
    expect(page).toEqual(
      expect.objectContaining({
        total: 1,
        pageIndex: 1,
        pageSize: 15,
      }),
    )
    expect(page).not.toHaveProperty('hasMore')
    expect(page).not.toHaveProperty('nextCursor')
    expect(selectRecorder.limit).toHaveBeenCalledWith(15)
    expect(selectRecorder.offset).toHaveBeenCalledWith(0)
    expect(drizzle.db.$count).toHaveBeenCalled()
    expect(page.list[0]).toEqual(
      expect.not.objectContaining({
        beforeData: expect.anything(),
        afterData: expect.anything(),
      }),
    )
  })

  it('allows admin queries to filter by actor and keep admin governance rows', async () => {
    const { service } = createActionLogService()
    const buildQueryWhereSpy = jest.spyOn(
      service as unknown as {
        buildQueryWhere: (query: {
          actorType?: number
          actorUserId?: number
          moderatorId?: number
        }) => unknown
      },
      'buildQueryWhere',
    )

    const page = await service.getAdminActionLogPage({
      actionType: ForumModeratorActionTypeEnum.RESTORE_TOPIC,
      actorType: 2,
      actorUserId: 9001,
      targetId: 22,
      targetType: ForumModeratorActionTargetTypeEnum.TOPIC,
    })

    expect(buildQueryWhereSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 2,
        actorUserId: 9001,
      }),
    )
    expect(page.list[0]).toEqual(
      expect.objectContaining({
        actorType: 1,
        actorUserId: 100,
        beforeData: '{"isHidden":false}',
        afterData: '{"isHidden":true}',
      }),
    )
  })
})
