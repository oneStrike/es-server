/// <reference types="jest" />

import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from '../moderator/moderator.constant'
import { BusinessErrorCode } from '@libs/platform/constant'
import { ForumSectionService } from './forum-section.service'

function createThenableBuilder<TResult>(result: TResult) {
  const promise = Promise.resolve(result)
  const builder: Record<string, ReturnType<typeof jest.fn>> & {
    then: Promise<TResult>['then']
    catch: Promise<TResult>['catch']
    finally: Promise<TResult>['finally']
  } = {
    from: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    leftJoin: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    where: jest.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  return builder
}

function createSectionService() {
  const db = {
    query: {
      forumSection: {
        findFirst: jest.fn(async () => ({
          id: 10,
          groupId: 2,
          isEnabled: true,
        })),
      },
    },
    select: jest.fn(() =>
      createThenableBuilder([
        {
          avatar: 'avatar.png',
          groupId: null,
          moderatorId: 9,
          nickname: 'Alice',
          permissions: [ForumModeratorPermissionEnum.AUDIT],
          roleType: ForumModeratorRoleTypeEnum.SECTION,
          userId: 100,
        },
      ]),
    ),
  }
  const drizzle = {
    db,
    schema: {
      appUser: {
        avatarUrl: 'avatarUrl',
        id: 'appUser.id',
        nickname: 'nickname',
      },
      forumModerator: {
        deletedAt: 'deletedAt',
        groupId: 'groupId',
        id: 'id',
        isEnabled: 'isEnabled',
        permissions: 'permissions',
        roleType: 'roleType',
        userId: 'userId',
      },
      forumModeratorSection: {
        moderatorId: 'moderatorId',
        sectionId: 'sectionId',
      },
      forumSection: {
        deletedAt: 'deletedAt',
        groupId: 'section.groupId',
        id: 'section.id',
        isEnabled: 'section.isEnabled',
      },
    },
  }
  const service = new ForumSectionService(
    drizzle as any,
    { isSectionPubliclyAvailable: jest.fn(() => true) } as any,
    {} as any,
    {} as any,
    {} as any,
  )

  return { db, service }
}

describe('ForumSectionService section moderators', () => {
  it('returns enabled moderator summaries for a visible section', async () => {
    const { db, service } = createSectionService()

    await expect(service.getVisibleSectionModerators(10)).resolves.toEqual([
      {
        avatar: 'avatar.png',
        moderatorId: 9,
        nickname: 'Alice',
        permissionNames: ['审核'],
        roleType: ForumModeratorRoleTypeEnum.SECTION,
        userId: 100,
      },
    ])

    expect(db.query.forumSection.findFirst).toHaveBeenCalled()
    expect(db.select).toHaveBeenCalled()
  })
})

function createDeleteSectionService(options?: {
  moderatorSection?: unknown
  work?: unknown
}) {
  const tx = {
    execute: jest.fn(async () => undefined),
    query: {
      forumModeratorSection: {
        findFirst: jest.fn(async () => options?.moderatorSection ?? null),
      },
      forumSection: {
        findFirst: jest.fn(async () => ({ id: 10 })),
      },
      forumTopic: {
        findFirst: jest.fn(async () => null),
      },
      work: {
        findFirst: jest.fn(async () => options?.work ?? null),
      },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(async () => ({ rowCount: 1 })),
      })),
    })),
  }
  const db = {
    transaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      callback(tx),
    ),
  }
  const drizzle = {
    assertAffectedRows: jest.fn(),
    db,
    schema: {
      appUser: {},
      forumModerator: {},
      forumModeratorSection: {
        moderatorId: 'moderatorId',
        sectionId: 'sectionId',
      },
      forumSection: {
        deletedAt: 'deletedAt',
        id: 'section.id',
      },
      forumTopic: {},
      work: {},
    },
    withTransaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      db.transaction(callback),
    ),
  }
  const service = new ForumSectionService(
    drizzle as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  return { drizzle, service, tx }
}

describe('ForumSectionService delete guards', () => {
  it('rejects deleting a section bound to an active work', async () => {
    const { service, tx } = createDeleteSectionService({ work: { id: 20 } })

    await expect(service.deleteSection(10)).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '该板块仍被作品绑定，无法删除',
    })

    expect(tx.execute).toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
  })

  it('rejects deleting a section referenced by moderator scope', async () => {
    const { service, tx } = createDeleteSectionService({
      moderatorSection: { moderatorId: 1, sectionId: 10 },
    })

    await expect(service.deleteSection(10)).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '该板块仍被版主作用域引用，无法删除',
    })

    expect(tx.update).not.toHaveBeenCalled()
  })
})

function createLifecycleMutationService(options?: {
  section?: null | { id: number }
  work?: null | { forumSectionId: number, id: number }
}) {
  const updateWhere = jest.fn(async () => ({ rowCount: 1 }))
  const updateSet = jest.fn(() => ({ where: updateWhere }))
  const tx = {
    execute: jest.fn(async () => undefined),
    query: {
      forumSection: {
        findFirst: jest.fn(async () => options?.section ?? { id: 10 }),
      },
      work: {
        findFirst: jest.fn(
          async () =>
            options && 'work' in options
              ? options.work
              : { forumSectionId: 10, id: 20 },
        ),
      },
    },
    update: jest.fn(() => ({ set: updateSet })),
  }
  const db = {
    transaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      callback(tx),
    ),
  }
  const drizzle = {
    assertAffectedRows: jest.fn(),
    db,
    schema: {
      appUser: {},
      forumModerator: {},
      forumModeratorSection: {},
      forumSection: {
        cover: 'cover',
        deletedAt: 'deletedAt',
        description: 'description',
        icon: 'icon',
        id: 'section.id',
        isEnabled: 'section.isEnabled',
        name: 'name',
        updatedAt: 'updatedAt',
      },
      work: {},
    },
    withTransaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      db.transaction(callback),
    ),
  }
  const service = new ForumSectionService(
    drizzle as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  return { drizzle, service, tx, updateSet, updateWhere }
}

describe('ForumSectionService lifecycle mutation locks', () => {
  it('locks the section before updating enabled status', async () => {
    const { service, tx, updateSet } = createLifecycleMutationService()

    await expect(
      service.updateEnabledStatus({ id: 10, isEnabled: false }),
    ).resolves.toBe(true)

    expect(tx.execute).toHaveBeenCalled()
    expect(tx.update).toHaveBeenCalled()
    expect(updateSet).toHaveBeenCalledWith({ isEnabled: false })
  })

  it('rejects managed section sync when the work binding does not match', async () => {
    const { service, tx } = createLifecycleMutationService({
      work: null,
    })

    await expect(
      service.syncManagedSectionForWork(tx as any, {
        sectionId: 10,
        workId: 20,
        name: '新版块',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '作品未绑定该托管板块',
    })

    expect(tx.execute).toHaveBeenCalled()
    expect(tx.update).not.toHaveBeenCalled()
  })
})

function createRebuildAllSectionCountsService(sectionIds: number[]) {
  const selectBuilder = {
    from: jest.fn(() => selectBuilder),
    orderBy: jest.fn(() =>
      Promise.resolve(sectionIds.map((id) => ({ id }))),
    ),
    where: jest.fn(() => selectBuilder),
  }
  const db = {
    select: jest.fn(() => selectBuilder),
  }
  const drizzle = {
    db,
    schema: {
      appUser: {},
      forumModerator: {},
      forumModeratorSection: {},
      forumSection: {
        deletedAt: 'deletedAt',
        id: 'section.id',
      },
    },
  }
  const service = new ForumSectionService(
    drizzle as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )

  return { service }
}

describe('ForumSectionService count repair limits', () => {
  it('rejects synchronous full repair when section count exceeds the limit', async () => {
    const { service } = createRebuildAllSectionCountsService([1, 2, 3])

    await expect(service.rebuildAllSectionCounts(200, 2)).rejects.toMatchObject(
      {
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: '板块数量超过同步重建上限 2，请改用后台任务执行全量重建',
      },
    )
  })
})
