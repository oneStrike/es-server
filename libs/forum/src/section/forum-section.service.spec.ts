import { ForumSectionService } from './forum-section.service'

describe('ForumSectionService', () => {
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
    expect(forumSectionGroupService.getAdminSectionTree).toHaveBeenCalledTimes(1)
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
        followersCount: 0,
      }),
    ).resolves.toBe(true)

    expect(lockSpy).toHaveBeenCalledWith(tx, [3])
    expect(insertValues).toHaveBeenCalled()
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
  })
})
