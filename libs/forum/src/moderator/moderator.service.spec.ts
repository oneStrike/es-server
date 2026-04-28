import { BusinessErrorCode } from '@libs/platform/constant'
import { ForumModeratorPermissionEnum, ForumModeratorRoleTypeEnum } from './moderator.constant'
import { ForumModeratorService } from './moderator.service'
import type { NormalizeModeratorScopeOptions } from './moderator.type'

type ForumModeratorPrivateApi = {
  normalizeScope: (
    input: {
      roleType?: number
      groupId?: number | null
      isEnabled?: boolean
      permissions?: Array<number | null | undefined> | null
      sectionIds?: number[]
    },
    options?: NormalizeModeratorScopeOptions,
  ) => Promise<{
    roleType: ForumModeratorRoleTypeEnum
    groupId: number | null
    permissions: ForumModeratorPermissionEnum[]
    sectionIds: number[]
  }>
}

describe('ForumModeratorService', () => {
  function createService() {
    const forumSectionGroupFindFirst = jest.fn()
    const forumModeratorFindMany = jest.fn()
    const execute = jest.fn().mockResolvedValue({ rows: [] })

    const service = new ForumModeratorService(
      {
        db: {
          execute,
          query: {
            forumSectionGroup: {
              findFirst: forumSectionGroupFindFirst,
            },
            forumModerator: {
              findMany: forumModeratorFindMany,
            },
          },
        },
        schema: {
          forumModerator: {},
          forumModeratorSection: {},
          forumSection: {},
          forumSectionGroup: {},
          appUser: {},
        },
      } as never,
    )

    return {
      service,
      privateApi: service as unknown as ForumModeratorPrivateApi,
      execute,
      forumSectionGroupFindFirst,
      forumModeratorFindMany,
    }
  }

  it('rejects enabling a group moderator when the group quota is already full', async () => {
    const {
      execute,
      forumModeratorFindMany,
      forumSectionGroupFindFirst,
      privateApi,
    } = createService()
    forumSectionGroupFindFirst.mockResolvedValue({
      id: 3,
      maxModerators: 1,
    })
    forumModeratorFindMany.mockResolvedValue([{ id: 11 }])

    await expect(
      privateApi.normalizeScope({
        roleType: ForumModeratorRoleTypeEnum.GROUP,
        groupId: 3,
        isEnabled: true,
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '该分组版主数量已达上限',
    })

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('excludes the current moderator when revalidating the same group quota', async () => {
    const { forumModeratorFindMany, forumSectionGroupFindFirst, privateApi } =
      createService()
    forumSectionGroupFindFirst.mockResolvedValue({
      id: 3,
      maxModerators: 1,
    })
    forumModeratorFindMany.mockResolvedValue([{ id: 8 }])

    await expect(
      privateApi.normalizeScope(
        {
          roleType: ForumModeratorRoleTypeEnum.GROUP,
          groupId: 3,
        },
        {
          current: {
            id: 8,
            roleType: ForumModeratorRoleTypeEnum.GROUP,
            groupId: 3,
            permissions: [ForumModeratorPermissionEnum.PIN],
            isEnabled: true,
          },
        },
      ),
    ).resolves.toEqual({
      roleType: ForumModeratorRoleTypeEnum.GROUP,
      groupId: 3,
      permissions: [ForumModeratorPermissionEnum.PIN],
      sectionIds: [],
    })
  })

  it('pre-locks both current and target groups when updating only groupId on a group moderator', async () => {
    const forumModeratorFindFirst = jest.fn().mockResolvedValue({
      id: 18,
      userId: 9,
      roleType: ForumModeratorRoleTypeEnum.GROUP,
      groupId: 5,
      permissions: [ForumModeratorPermissionEnum.PIN],
      isEnabled: true,
      remark: null,
      deletedAt: null,
    })
    const forumSectionGroupFindFirst = jest
      .fn()
      .mockResolvedValue({ id: 3, maxModerators: 5 })
    const forumModeratorFindMany = jest.fn().mockResolvedValue([])
    const execute = jest.fn().mockResolvedValue({ rows: [] })
    const updateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
    const deleteWhere = jest.fn().mockResolvedValue({ rowCount: 0 })
    const tx = {
      execute,
      query: {
        forumModerator: {
          findFirst: forumModeratorFindFirst,
          findMany: forumModeratorFindMany,
        },
        forumSectionGroup: {
          findFirst: forumSectionGroupFindFirst,
        },
      },
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue([]),
        })),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: updateWhere,
        })),
      })),
      delete: jest.fn(() => ({
        where: deleteWhere,
      })),
    }
    const drizzle = {
      db: {
        transaction: jest.fn(
          async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
        ),
      },
      schema: {
        forumModerator: {},
        forumModeratorSection: {},
        forumSection: {},
        forumSectionGroup: {},
        appUser: {},
      },
      withErrorHandling: jest.fn(async (callback: () => Promise<void>) =>
        callback(),
      ),
      assertAffectedRows: jest.fn(),
    }
    const service = new ForumModeratorService(drizzle as never)
    const lockSpy = jest.spyOn(
      service as unknown as { lockSectionGroupsForMutation: (...args: unknown[]) => Promise<void> },
      'lockSectionGroupsForMutation',
    )

    await expect(
      service.updateModerator({
        id: 18,
        groupId: 3,
      }),
    ).resolves.toBe(true)

    expect(lockSpy).toHaveBeenCalled()
    expect(lockSpy.mock.calls[0]?.[1]).toEqual([5, 3])
  })
})
