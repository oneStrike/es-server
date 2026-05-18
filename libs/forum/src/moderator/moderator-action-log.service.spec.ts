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

function createActionLogService() {
  const pagination = jest.fn(async () => ({
    list: [
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
    ],
    pageIndex: 1,
    pageSize: 15,
    total: 1,
  }))
  const drizzle = {
    db: {
      insert: jest.fn(() => createThenableBuilder([{ id: 1 }])),
    },
    ext: {
      findPagination: pagination,
    },
    schema: {
      forumModeratorActionLog: {
        actionType: 'actionType',
        createdAt: 'createdAt',
        moderatorId: 'moderatorId',
        targetId: 'targetId',
        targetType: 'targetType',
      },
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
  const service = new ForumModeratorActionLogService(drizzle as any)

  return { drizzle, pagination, service }
}

describe('ForumModeratorActionLogService query', () => {
  it('forces app self-audit queries to the current moderator and strips snapshots', async () => {
    const { pagination, service } = createActionLogService()
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
    expect(pagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
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
