import { BusinessErrorCode } from '@libs/platform/constant'
import { ForumSectionService } from './forum-section.service'

describe('forum section service', () => {
  const createVisibleSectionService = () => {
    const findMany = jest.fn().mockResolvedValue([])
    const service = new ForumSectionService(
      {
        db: {
          query: {
            forumSection: {
              findMany,
            },
          },
        },
      } as never,
      { isSectionPubliclyAvailable: jest.fn().mockReturnValue(true) } as never,
      {} as never,
      {} as never,
      { getAdminSectionTree: jest.fn() } as never,
    )

    return {
      findMany,
      service,
    }
  }

  it('delegates admin tree assembly to the section-group service', async () => {
    const tree = [
      {
        isUngrouped: false,
        group: {
          id: 1,
          name: '官方社区',
        },
        sections: [],
      },
    ]
    const forumSectionGroupService = {
      getAdminSectionTree: jest.fn().mockResolvedValue(tree),
    }

    const service = new ForumSectionService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      forumSectionGroupService as never,
    )

    await expect(service.getSectionTree()).resolves.toBe(tree)
    expect(forumSectionGroupService.getAdminSectionTree).toHaveBeenCalledTimes(
      1,
    )
  })

  it('builds visible section query scopes from public list filters', async () => {
    const { findMany, service } = createVisibleSectionService()

    await service.getVisibleSectionList()
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          deletedAt: { isNull: true },
        },
      }),
    )

    await service.getVisibleSectionList({ isUngrouped: true })
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          deletedAt: { isNull: true },
          groupId: { isNull: true },
        },
      }),
    )

    await service.getVisibleSectionList({ groupId: 7 })
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          deletedAt: { isNull: true },
          groupId: 7,
        },
      }),
    )

    await service.getVisibleSectionList({ groupId: 7, isUngrouped: true })
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          deletedAt: { isNull: true },
          groupId: { isNull: true },
        },
      }),
    )
  })

  it('uses unique section ids as the visible section batch scope', async () => {
    const { findMany, service } = createVisibleSectionService()

    await service.batchGetVisibleSectionListItems([3, 3, 4])

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isEnabled: true,
          deletedAt: { isNull: true },
          id: { in: [3, 4] },
        },
      }),
    )
  })

  it('skips visible section batch queries for empty id lists', async () => {
    const { findMany, service } = createVisibleSectionService()

    await expect(service.batchGetVisibleSectionListItems([])).resolves.toEqual(
      [],
    )
    expect(findMany).not.toHaveBeenCalled()
  })

  it('locks the target group before creating a grouped section', async () => {
    const forumSectionFindFirst = jest.fn().mockResolvedValue(null)
    const forumSectionGroupFindFirst = jest.fn().mockResolvedValue({ id: 3 })
    const execute = jest.fn().mockResolvedValue({ rows: [] })
    const insertValues = jest.fn().mockResolvedValue(undefined)
    const tx = {
      execute,
      query: {
        forumSectionGroup: {
          findFirst: forumSectionGroupFindFirst,
        },
        userLevelRule: {
          findFirst: jest.fn(),
        },
      },
      insert: jest.fn(() => ({
        values: insertValues,
      })),
    }
    const drizzle = {
      db: {
        query: {
          forumSection: {
            findFirst: forumSectionFindFirst,
          },
        },
      },
      schema: {
        forumSection: {},
        forumSectionGroup: {},
        userLevelRule: {},
      },
      withTransaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
      ),
    }
    const service = new ForumSectionService(
      drizzle as never,
      { isSectionPubliclyAvailable: jest.fn() } as never,
      {} as never,
      {} as never,
      { getAdminSectionTree: jest.fn() } as never,
    )
    const lockSpy = jest.spyOn(
      service as unknown as {
        lockSectionGroupsForMutation: (...args: unknown[]) => Promise<void>
      },
      'lockSectionGroupsForMutation',
    )

    await expect(
      service.createSection({
        name: '新手报到',
        groupId: 3,
        icon: 'icon',
        cover: 'cover',
        sortOrder: 0,
        isEnabled: true,
        topicReviewPolicy: 1,
      }),
    ).resolves.toBe(true)

    expect(lockSpy).toHaveBeenCalledWith(tx, [3])
    expect(insertValues).toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      duplicate: '板块名称已存在',
    })
  })

  it('locks both current and target groups before moving a section to another group', async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [] })
    const updateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
    const forumSectionFindFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 10,
        name: '旧板块',
        groupId: 5,
        userLevelRuleId: null,
        deletedAt: null,
      })
      .mockResolvedValueOnce({ id: 3 })
    const tx = {
      execute,
      query: {
        forumSection: {
          findFirst: forumSectionFindFirst,
        },
        forumSectionGroup: {
          findFirst: jest.fn().mockResolvedValue({ id: 3 }),
        },
        userLevelRule: {
          findFirst: jest.fn(),
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: updateWhere,
        })),
      })),
    }
    const drizzle = {
      db: {},
      schema: {
        forumSection: {},
        forumSectionGroup: {},
        userLevelRule: {},
      },
      withTransaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
      ),
      assertAffectedRows: jest.fn(),
    }
    const service = new ForumSectionService(
      drizzle as never,
      { isSectionPubliclyAvailable: jest.fn() } as never,
      {} as never,
      {} as never,
      { getAdminSectionTree: jest.fn() } as never,
    )
    const lockSpy = jest.spyOn(
      service as unknown as {
        lockSectionGroupsForMutation: (...args: unknown[]) => Promise<void>
      },
      'lockSectionGroupsForMutation',
    )

    await expect(
      service.updateSection({
        id: 10,
        groupId: 3,
      }),
    ).resolves.toBe(true)

    expect(lockSpy).toHaveBeenCalledWith(tx, [5, 3])
    expect(updateWhere).toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      duplicate: '板块名称已存在',
    })
  })

  it('blocks deleting a section when live topics still exist in the fact table', async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [] })
    const updateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
    const tx = {
      execute,
      query: {
        forumSection: {
          findFirst: jest.fn().mockResolvedValue({ id: 7 }),
        },
        forumTopic: {
          findFirst: jest.fn().mockResolvedValue({ id: 99 }),
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: updateWhere,
        })),
      })),
    }
    const drizzle = {
      schema: {
        forumSection: {},
      },
      withTransaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
      ),
      assertAffectedRows: jest.fn(),
    }
    const service = new ForumSectionService(
      drizzle as never,
      { isSectionPubliclyAvailable: jest.fn() } as never,
      {} as never,
      {} as never,
      { getAdminSectionTree: jest.fn() } as never,
    )
    const lockSpy = jest.spyOn(
      service as unknown as {
        lockSectionForMutation: (...args: unknown[]) => Promise<void>
      },
      'lockSectionForMutation',
    )

    await expect(service.deleteSection(7)).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '该板块还有主题，无法删除',
    })

    expect(lockSpy).toHaveBeenCalledWith(tx, 7)
    expect(updateWhere).not.toHaveBeenCalled()
  })

  it('passes a live-row guard into section sort swapping', async () => {
    const swapField = jest.fn().mockResolvedValue(true)
    const forumSectionTable = {
      deletedAt: 'forum_section.deleted_at',
    }
    const service = new ForumSectionService(
      {
        schema: {
          forumSection: forumSectionTable,
        },
        ext: {
          swapField,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    await expect(
      service.updateSectionSort({
        dragId: 3,
        targetId: 4,
      }),
    ).resolves.toBe(true)

    expect(swapField).toHaveBeenCalledWith(
      forumSectionTable,
      expect.objectContaining({
        where: [{ id: 3 }, { id: 4 }],
        sourceField: 'groupId',
        recordWhere: expect.anything(),
      }),
    )
  })
})
