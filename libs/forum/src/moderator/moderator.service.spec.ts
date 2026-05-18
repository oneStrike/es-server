/// <reference types="jest" />

import { BusinessException } from '@libs/platform/exceptions'
import { ForumModeratorPermissionEnum, ForumModeratorRoleTypeEnum } from './moderator.constant'
import { ForumModeratorService } from './moderator.service'

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
    delete: jest.fn(() => builder),
    from: jest.fn(() => builder),
    onConflictDoUpdate: jest.fn(() => promise),
    set: jest.fn(() => builder),
    values: jest.fn(() => builder),
    where: jest.fn(() => promise),
    returning: jest.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  Object.assign(recorder, builder)
  return builder
}

function createModeratorService() {
  const insertRecorder: Record<string, ReturnType<typeof jest.fn>> = {}
  const tx = {
    delete: jest.fn(() => createThenableBuilder({ rowCount: 1 })),
    execute: jest.fn(),
    insert: jest.fn(() => createThenableBuilder([{ id: 99 }], insertRecorder)),
    query: {
      appUser: {
        findFirst: jest.fn(async () => ({ id: 1 })),
      },
      forumModerator: {
        findFirst: jest.fn(async (): Promise<unknown> => undefined),
        findMany: jest.fn(async () => []),
      },
      forumSectionGroup: {
        findFirst: jest.fn(async () => ({ id: 2, maxModerators: 0 })),
      },
    },
    select: jest.fn(() => createThenableBuilder([{ id: 10 }])),
    update: jest.fn(() => createThenableBuilder({ rowCount: 1 })),
  }
  const db = {
    query: tx.query,
    transaction: jest.fn(async (callback: (runner: typeof tx) => unknown) =>
      callback(tx),
    ),
  }
  const drizzle = {
    assertAffectedRows: jest.fn(),
    db,
    schema: {
      appUser: { id: 'appUser.id', deletedAt: 'appUser.deletedAt' },
      forumModerator: {
        deletedAt: 'forumModerator.deletedAt',
        groupId: 'forumModerator.groupId',
        id: 'forumModerator.id',
        isEnabled: 'forumModerator.isEnabled',
        roleType: 'forumModerator.roleType',
        userId: 'forumModerator.userId',
      },
      forumModeratorSection: {
        moderatorId: 'forumModeratorSection.moderatorId',
        permissions: 'forumModeratorSection.permissions',
        sectionId: 'forumModeratorSection.sectionId',
      },
      forumSection: {
        deletedAt: 'forumSection.deletedAt',
        id: 'forumSection.id',
      },
      forumSectionGroup: {
        deletedAt: 'forumSectionGroup.deletedAt',
        id: 'forumSectionGroup.id',
      },
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }

  const service = new ForumModeratorService(drizzle as any)

  return { service, drizzle, tx, insertRecorder }
}

describe('ForumModeratorService permissions', () => {
  it('rejects enabled group moderators without base permissions', async () => {
    const { service, tx } = createModeratorService()

    await expect(
      service.createModerator({
        groupId: 2,
        isEnabled: true,
        permissions: [],
        roleType: ForumModeratorRoleTypeEnum.GROUP,
        userId: 1,
      }),
    ).rejects.toBeInstanceOf(BusinessException)

    expect(tx.insert).not.toHaveBeenCalled()
  })

  it('rejects enabling a section moderator whose effective base permissions are empty', async () => {
    const { service, tx } = createModeratorService()
    tx.query.forumModerator.findFirst = jest.fn(async () => ({
      groupId: null,
      id: 9,
      isEnabled: false,
      permissions: [],
      roleType: ForumModeratorRoleTypeEnum.SECTION,
    }))

    await expect(
      service.updateModerator({
        id: 9,
        isEnabled: true,
      }),
    ).rejects.toBeInstanceOf(BusinessException)

    expect(tx.update).not.toHaveBeenCalled()
  })

  it('keeps empty assign-section permissions as inheritance instead of base permission clearing', async () => {
    const { insertRecorder, service, tx } = createModeratorService()
    tx.query.forumModerator.findFirst = jest.fn(async () => ({
      id: 9,
      roleType: ForumModeratorRoleTypeEnum.SECTION,
    }))
    tx.select = jest
      .fn()
      .mockReturnValueOnce(createThenableBuilder([{ id: 10 }]))
      .mockReturnValueOnce(createThenableBuilder([]))

    await service.assignModeratorSection({
      moderatorId: 9,
      sectionIds: [10],
    })

    expect(insertRecorder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        moderatorId: 9,
        permissions: [],
        sectionId: 10,
      }),
    )
  })

  it('allows disabled non-super moderators to be saved without active permissions', async () => {
    const { insertRecorder, service } = createModeratorService()

    await expect(
      service.createModerator({
        groupId: 2,
        isEnabled: false,
        permissions: [],
        roleType: ForumModeratorRoleTypeEnum.GROUP,
        userId: 1,
      }),
    ).resolves.toBe(true)

    expect(insertRecorder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: [],
      }),
    )
  })

  it('normalizes super moderators to the full permission set', async () => {
    const { insertRecorder, service } = createModeratorService()

    await service.createModerator({
      isEnabled: true,
      roleType: ForumModeratorRoleTypeEnum.SUPER,
      userId: 1,
    })

    expect(insertRecorder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        permissions: [
          ForumModeratorPermissionEnum.PIN,
          ForumModeratorPermissionEnum.FEATURE,
          ForumModeratorPermissionEnum.LOCK,
          ForumModeratorPermissionEnum.DELETE,
          ForumModeratorPermissionEnum.AUDIT,
          ForumModeratorPermissionEnum.MOVE,
        ],
      }),
    )
  })
})
