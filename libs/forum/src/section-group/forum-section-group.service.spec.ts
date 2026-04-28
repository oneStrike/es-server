import { BusinessErrorCode } from '@libs/platform/constant'
import { ForumSectionGroupService } from './forum-section-group.service'

describe('ForumSectionGroupService', () => {
  function createService() {
    const forumSectionGroupFindMany = jest.fn()
    const forumSectionFindMany = jest.fn()
    const forumSectionGroupFindFirst = jest.fn()
    const updateWhere = jest.fn().mockResolvedValue({ rowCount: 1 })
    const execute = jest.fn().mockResolvedValue({ rows: [] })
    const swapField = jest.fn().mockResolvedValue(true)
    const tx = {
      execute,
      query: {
        forumSectionGroup: {
          findFirst: forumSectionGroupFindFirst,
        },
      },
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: updateWhere,
        })),
      })),
    }

    const drizzle = {
      db: {
        execute,
        query: {
          forumSectionGroup: {
            findMany: forumSectionGroupFindMany,
            findFirst: forumSectionGroupFindFirst,
          },
          forumSection: {
            findMany: forumSectionFindMany,
          },
        },
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: updateWhere,
          })),
        })),
      },
      schema: {
        forumSectionGroup: {
          deletedAt: 'forum_section_group.deleted_at',
        },
      },
      ext: {
        swapField,
      },
      assertAffectedRows: jest.fn(),
      withErrorHandling: jest.fn(async (callback: () => Promise<unknown>) =>
        callback(),
      ),
      withTransaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    }

    const service = new ForumSectionGroupService(
      drizzle as never,
      {} as never,
      {} as never,
    )

    return {
      service,
      forumSectionGroupFindMany,
      forumSectionFindMany,
      forumSectionGroupFindFirst,
      updateWhere,
      execute,
      swapField,
    }
  }

  it('builds the admin tree with grouped and ungrouped sections', async () => {
    const { service, forumSectionFindMany, forumSectionGroupFindMany } =
      createService()
    const now = new Date('2026-04-28T00:00:00.000Z')

    const groups = [
      {
        id: 1,
        name: '官方社区',
        description: '公告分组',
        sortOrder: 1,
        isEnabled: true,
        maxModerators: 3,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        name: '创作交流',
        description: '创作分组',
        sortOrder: 2,
        isEnabled: false,
        maxModerators: 5,
        createdAt: now,
        updatedAt: now,
      },
    ]
    const sections = [
      {
        id: 11,
        groupId: 1,
        userLevelRuleId: null,
        lastTopicId: null,
        name: '新手报到',
        description: '欢迎新用户',
        icon: 'icon-a',
        cover: 'cover-a',
        sortOrder: 1,
        isEnabled: true,
        topicReviewPolicy: 1,
        remark: null,
        topicCount: 3,
        commentCount: 7,
        followersCount: 2,
        lastPostAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 12,
        groupId: null,
        userLevelRuleId: null,
        lastTopicId: null,
        name: '未分组板块',
        description: '独立板块',
        icon: 'icon-b',
        cover: 'cover-b',
        sortOrder: 2,
        isEnabled: true,
        topicReviewPolicy: 1,
        remark: null,
        topicCount: 1,
        commentCount: 2,
        followersCount: 0,
        lastPostAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 13,
        groupId: 99,
        userLevelRuleId: null,
        lastTopicId: null,
        name: '孤儿板块',
        description: '挂在失效分组下',
        icon: 'icon-c',
        cover: 'cover-c',
        sortOrder: 3,
        isEnabled: false,
        topicReviewPolicy: 1,
        remark: null,
        topicCount: 0,
        commentCount: 0,
        followersCount: 0,
        lastPostAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]
    forumSectionGroupFindMany.mockResolvedValue(groups)
    forumSectionFindMany.mockResolvedValue(sections)

    await expect(service.getAdminSectionTree()).resolves.toEqual([
      {
        isUngrouped: false,
        group: groups[0],
        sections: [sections[0]],
      },
      {
        isUngrouped: false,
        group: groups[1],
        sections: [],
      },
      {
        isUngrouped: true,
        sections: [sections[1], sections[2]],
      },
    ])
  })

  it('prevents deleting a group while moderators are still bound to it', async () => {
    const { execute, forumSectionGroupFindFirst, service, updateWhere } =
      createService()
    forumSectionGroupFindFirst.mockResolvedValue({
      id: 5,
      sections: [],
      moderators: [{ id: 9 }],
    })

    await expect(service.deleteSectionGroup(5)).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '该分组下还有版主，无法删除',
    })

    expect(updateWhere).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('keeps an empty ungrouped bucket when every section already belongs to a group', async () => {
    const { service, forumSectionFindMany, forumSectionGroupFindMany } =
      createService()
    const now = new Date('2026-04-28T00:00:00.000Z')

    forumSectionGroupFindMany.mockResolvedValue([
      {
        id: 1,
        name: '官方社区',
        description: '公告分组',
        sortOrder: 1,
        isEnabled: true,
        maxModerators: 3,
        createdAt: now,
        updatedAt: now,
      },
    ])
    forumSectionFindMany.mockResolvedValue([
      {
        id: 11,
        groupId: 1,
        userLevelRuleId: null,
        lastTopicId: null,
        name: '新手报到',
        description: '欢迎新用户',
        icon: 'icon-a',
        cover: 'cover-a',
        sortOrder: 1,
        isEnabled: true,
        topicReviewPolicy: 1,
        remark: null,
        topicCount: 3,
        commentCount: 7,
        followersCount: 2,
        lastPostAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ])

    await expect(service.getAdminSectionTree()).resolves.toEqual([
      {
        isUngrouped: false,
        group: {
          id: 1,
          name: '官方社区',
          description: '公告分组',
          sortOrder: 1,
          isEnabled: true,
          maxModerators: 3,
          createdAt: now,
          updatedAt: now,
        },
        sections: [
          expect.objectContaining({
            id: 11,
            groupId: 1,
          }),
        ],
      },
      {
        isUngrouped: true,
        sections: [],
      },
    ])
  })

  it('passes a live-row guard into section-group sort swapping', async () => {
    const { service, swapField } = createService()

    await expect(
      service.swapSectionGroupSortOrder({
        dragId: 1,
        targetId: 2,
      }),
    ).resolves.toBe(true)

    expect(swapField).toHaveBeenCalledWith(
      expect.objectContaining({
        deletedAt: 'forum_section_group.deleted_at',
      }),
      expect.objectContaining({
        where: [{ id: 1 }, { id: 2 }],
        recordWhere: expect.anything(),
      }),
    )
  })
})
