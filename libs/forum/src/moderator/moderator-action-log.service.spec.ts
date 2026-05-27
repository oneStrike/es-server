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
  const builder: Record<string, ReturnType<typeof jest.fn>> = {
    from: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    offset: jest.fn(async () => result),
    orderBy: jest.fn(() => builder),
    where: jest.fn(() => builder),
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
      targetId: 21,
      targetType: ForumModeratorActionTargetTypeEnum.COMMENT,
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
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
  const service = new ForumModeratorActionLogService(drizzle as any)

  return { drizzle, selectRecorder, service }
}

describe('ForumModeratorActionLogService query', () => {
  it('forces app self-audit queries to the current moderator and strips snapshots', async () => {
    const { drizzle, service } = createActionLogService()
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
    )
    expect(drizzle.buildOrderBy).toHaveBeenCalledWith(
      { createdAt: 'desc' },
      expect.objectContaining({
        table: drizzle.schema.forumModeratorActionLog,
      }),
    )
    expect(page.list[0]).toEqual(
      expect.not.objectContaining({
        beforeData: expect.anything(),
        afterData: expect.anything(),
      }),
    )
  })

  it('allows admin queries to filter by moderator and keep snapshots', async () => {
    const { service } = createActionLogService()

    const page = await service.getAdminActionLogPage({
      actionType: ForumModeratorActionTypeEnum.HIDE_COMMENT,
      moderatorId: 5,
      targetId: 21,
      targetType: ForumModeratorActionTargetTypeEnum.COMMENT,
    })

    expect(page.list[0]).toEqual(
      expect.objectContaining({
        beforeData: '{"isHidden":false}',
        afterData: '{"isHidden":true}',
      }),
    )
  })
})
