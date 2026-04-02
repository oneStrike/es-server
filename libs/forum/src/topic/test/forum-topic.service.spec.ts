import { GrowthRuleTypeEnum } from '@libs/growth/growth'
import { AuditStatusEnum } from '@libs/platform/constant'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  buildLikePattern: jest.fn((value?: string) =>
    value?.trim() ? `%${value.trim()}%` : undefined,
  ),
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

jest.mock('@libs/growth/growth-reward', () => ({
  GrowthEventBridgeService: class {},
}))

jest.mock('@libs/interaction/browse-log', () => ({
  BrowseLogService: class {},
  BrowseLogTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/comment', () => ({
  CommentTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/emoji', () => ({
  EmojiParserService: class {},
  EmojiSceneEnum: {
    FORUM: 'FORUM',
  },
}))

jest.mock('@libs/interaction/favorite', () => ({
  FavoriteService: class {},
  FavoriteTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/interaction/follow', () => ({
  FollowService: class {},
  FollowTargetTypeEnum: {
    USER: 1,
  },
}))

jest.mock('@libs/interaction/like', () => ({
  LikeService: class {},
  LikeTargetTypeEnum: {
    FORUM_TOPIC: 3,
  },
}))

jest.mock('@libs/sensitive-word', () => ({
  SensitiveWordDetectService: class {},
  SensitiveWordLevelEnum: {
    GENERAL: 2,
    SEVERE: 3,
  },
}))

jest.mock('@libs/user/core', () => ({
  AppUserCountService: class {},
}))

describe('forum topic audit reward backfill', () => {
  it('rewards create-topic once when audit changes from pending to approved', async () => {
    const { ForumTopicService } = await import('../forum-topic.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const syncSectionVisibleState = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()
    const currentTopic = {
      id: 11,
      sectionId: 5,
      userId: 9,
      auditStatus: AuditStatusEnum.PENDING,
    }

    const whereUpdate = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where: whereUpdate }))
    const update = jest.fn(() => ({ set }))
    const transaction = jest.fn(async (callback) => callback({ update } as any))
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumTopic: {
              findFirst: jest.fn().mockResolvedValue(currentTopic),
            },
          },
          transaction,
        },
        schema: {
          forumTopic: {
            id: 'id',
            deletedAt: 'deletedAt',
          },
        },
        withErrorHandling,
        assertAffectedRows,
      } as any,
      { dispatchDefinedEvent } as any,
      {} as any,
      {} as any,
      { syncSectionVisibleState } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateTopicAuditStatus({
        id: 11,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '审核通过',
      } as any),
    ).resolves.toBe(true)

    expect(dispatchDefinedEvent).toHaveBeenCalledWith({
      eventEnvelope: expect.objectContaining({
        code: GrowthRuleTypeEnum.CREATE_TOPIC,
        subjectId: 9,
        targetId: 11,
      }),
      bizKey: 'forum:topic:create:11:user:9',
      source: 'forum_topic',
      remark: 'approve forum topic #11',
    })
  })

  it('does not reward when the topic was already approved before update', async () => {
    const { ForumTopicService } = await import('../forum-topic.service')

    const dispatchDefinedEvent = jest.fn().mockResolvedValue(undefined)
    const syncSectionVisibleState = jest.fn().mockResolvedValue(undefined)
    const assertAffectedRows = jest.fn()
    const currentTopic = {
      id: 12,
      sectionId: 6,
      userId: 10,
      auditStatus: AuditStatusEnum.APPROVED,
    }

    const whereUpdate = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where: whereUpdate }))
    const update = jest.fn(() => ({ set }))
    const transaction = jest.fn(async (callback) => callback({ update } as any))
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumTopic: {
              findFirst: jest.fn().mockResolvedValue(currentTopic),
            },
          },
          transaction,
        },
        schema: {
          forumTopic: {
            id: 'id',
            deletedAt: 'deletedAt',
          },
        },
        withErrorHandling,
        assertAffectedRows,
      } as any,
      { dispatchDefinedEvent } as any,
      {} as any,
      {} as any,
      { syncSectionVisibleState } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    await expect(
      service.updateTopicAuditStatus({
        id: 12,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: '重复提交',
      } as any),
    ).resolves.toBe(true)

    expect(dispatchDefinedEvent).not.toHaveBeenCalled()
  })
})

describe('forum topic admin page payload', () => {
  it('returns page items with content snippets instead of full content', async () => {
    const { ForumTopicService } = await import('../forum-topic.service')

    const orderBy = jest.fn().mockResolvedValue([
      {
        id: 301,
        sectionId: 9,
        userId: 7,
        title: '后台主题',
        contentSnippet: '这是后台主题的摘要',
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: true,
        isLocked: false,
        isHidden: false,
        auditStatus: AuditStatusEnum.APPROVED,
        auditReason: null,
        auditAt: null,
        viewCount: 12,
        likeCount: 2,
        commentCount: 3,
        favoriteCount: 1,
        lastCommentAt: new Date('2026-03-29T00:00:00.000Z'),
        lastCommentUserId: 8,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-29T00:00:00.000Z'),
      },
    ])
    const offset = jest.fn(() => ({ orderBy }))
    const limit = jest.fn(() => ({ offset }))
    const where = jest.fn(() => ({ limit }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const count = jest.fn().mockResolvedValue(1)
    const buildPage = jest.fn().mockReturnValue({
      pageIndex: 1,
      pageSize: 20,
      limit: 20,
      offset: 0,
    })
    const buildOrderBy = jest.fn().mockReturnValue({
      orderBySql: ['topic.id desc'],
    })

    const service = new ForumTopicService(
      {
        db: {
          select,
          $count: count,
        },
        buildPage,
        buildOrderBy,
        schema: {
          forumTopic: {
            id: 'id',
            sectionId: 'sectionId',
            userId: 'userId',
            title: 'title',
            content: 'content',
            images: 'images',
            videos: 'videos',
            isPinned: 'isPinned',
            isFeatured: 'isFeatured',
            isLocked: 'isLocked',
            isHidden: 'isHidden',
            deletedAt: 'deletedAt',
            auditStatus: 'auditStatus',
            auditReason: 'auditReason',
            auditAt: 'auditAt',
            viewCount: 'viewCount',
            likeCount: 'likeCount',
            commentCount: 'commentCount',
            favoriteCount: 'favoriteCount',
            lastCommentAt: 'lastCommentAt',
            lastCommentUserId: 'lastCommentUserId',
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const result = await service.getTopics({
      sectionId: 9,
      auditStatus: AuditStatusEnum.APPROVED,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(buildPage).toHaveBeenCalledWith({
      pageIndex: 1,
      pageSize: 20,
    })
    expect(buildOrderBy).toHaveBeenCalled()
    expect(count).toHaveBeenCalled()
    expect(result.list).toEqual([
      expect.objectContaining({
        id: 301,
        title: '后台主题',
        contentSnippet: '这是后台主题的摘要',
      }),
    ])
    expect(result.list[0]).not.toHaveProperty('content')
  })
})

describe('forum topic public page payload', () => {
  it('returns unified relation, interaction, and snippet fields for each public topic item', async () => {
    const { ForumTopicService } = await import('../forum-topic.service')

    const ensureUserCanAccessSection = jest.fn().mockResolvedValue(undefined)
    const orderBy = jest.fn().mockResolvedValue([
      {
        id: 101,
        sectionId: 9,
        userId: 7,
        title: '公开主题',
        contentSnippet: '这是公开主题的摘要',
        images: [],
        videos: [],
        isPinned: false,
        isFeatured: true,
        isLocked: false,
        viewCount: 12,
        commentCount: 3,
        likeCount: 2,
        favoriteCount: 1,
        lastCommentAt: new Date('2026-03-29T00:00:00.000Z'),
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
      },
    ])
    const offset = jest.fn(() => ({ orderBy }))
    const limit = jest.fn(() => ({ offset }))
    const where = jest.fn(() => ({ limit }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const count = jest.fn().mockResolvedValue(1)
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 7,
        nickname: '发帖用户',
        avatarUrl: 'https://example.com/avatar.png',
      },
    ])
    const findSectionFirst = jest.fn().mockResolvedValue({
      id: 9,
      name: '综合讨论',
      icon: 'section-icon.png',
      cover: 'section-cover.png',
    })
    const likedStatusBatch = jest.fn().mockResolvedValue(new Map([[101, true]]))
    const favoritedStatusBatch = jest
      .fn()
      .mockResolvedValue(new Map([[101, false]]))
    const buildPage = jest.fn().mockReturnValue({
      pageIndex: 1,
      pageSize: 20,
      limit: 20,
      offset: 0,
    })
    const buildOrderBy = jest.fn().mockReturnValue({
      orderBySql: ['topic.isPinned desc'],
    })

    const service = new ForumTopicService(
      {
        db: {
          query: {
            appUser: {
              findMany,
            },
            forumSection: {
              findFirst: findSectionFirst,
            },
          },
          select,
          $count: count,
        },
        buildPage,
        buildOrderBy,
        schema: {
          forumTopic: {
            id: 'id',
            sectionId: 'sectionId',
            userId: 'userId',
            title: 'title',
            content: 'content',
            images: 'images',
            videos: 'videos',
            isPinned: 'isPinned',
            isFeatured: 'isFeatured',
            isLocked: 'isLocked',
            deletedAt: 'deletedAt',
            auditStatus: 'auditStatus',
            isHidden: 'isHidden',
            viewCount: 'viewCount',
            likeCount: 'likeCount',
            commentCount: 'commentCount',
            favoriteCount: 'favoriteCount',
            lastCommentAt: 'lastCommentAt',
            createdAt: 'createdAt',
          },
        },
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { ensureUserCanAccessSection } as any,
      { checkStatusBatch: likedStatusBatch } as any,
      { checkStatusBatch: favoritedStatusBatch } as any,
      {} as any,
      {} as any,
    )

    const result = await service.getPublicTopics({
      sectionId: 9,
      userId: 5,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(ensureUserCanAccessSection).toHaveBeenCalledWith(9, 5, {
      requireEnabled: true,
    })
    expect(likedStatusBatch).toHaveBeenCalledWith(3, [101], 5)
    expect(favoritedStatusBatch).toHaveBeenCalledWith(3, [101], 5)
    expect(result.list).toEqual([
      expect.objectContaining({
        id: 101,
        contentSnippet: '这是公开主题的摘要',
        liked: true,
        favorited: false,
        section: {
          id: 9,
          name: '综合讨论',
          icon: 'section-icon.png',
          cover: 'section-cover.png',
        },
        user: {
          id: 7,
          nickname: '发帖用户',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    ])
  })
})

describe('forum topic public detail payload', () => {
  it('already returns author brief info and interaction status', async () => {
    const { ForumTopicService } = await import('../forum-topic.service')

    const ensureUserCanAccessSection = jest.fn().mockResolvedValue(undefined)
    const checkLikeStatus = jest.fn().mockResolvedValue(true)
    const checkFavoriteStatus = jest.fn().mockResolvedValue(false)
    const checkFollowStatus = jest.fn().mockResolvedValue({ isFollowing: true })
    const recordBrowseLogSafely = jest.fn().mockResolvedValue(undefined)
    const findFirst = jest.fn().mockResolvedValue({
      id: 101,
      sectionId: 9,
      userId: 7,
      title: '详情主题',
      content: '详情内容',
      images: [],
      videos: [],
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      viewCount: 10,
      likeCount: 2,
      commentCount: 3,
      favoriteCount: 1,
      version: 0,
      lastCommentAt: new Date('2026-03-29T00:00:00.000Z'),
      createdAt: new Date('2026-03-28T00:00:00.000Z'),
      updatedAt: new Date('2026-03-29T00:00:00.000Z'),
      tags: [],
      user: {
        id: 7,
        nickname: '详情作者',
        avatarUrl: 'https://example.com/avatar.png',
      },
    })

    const service = new ForumTopicService(
      {
        db: {
          query: {
            forumTopic: {
              findFirst,
            },
          },
        },
      } as any,
      {} as any,
      {} as any,
      { recordBrowseLogSafely } as any,
      {} as any,
      {} as any,
      {} as any,
      { ensureUserCanAccessSection } as any,
      { checkLikeStatus } as any,
      { checkFavoriteStatus } as any,
      { checkFollowStatus } as any,
      {} as any,
    )

    const result = await service.getPublicTopicById(101, {
      userId: 5,
      ipAddress: '127.0.0.1',
      device: 'device-1',
    })

    expect(ensureUserCanAccessSection).toHaveBeenCalledWith(9, 5, {
      requireEnabled: true,
      notFoundMessage: '主题不存在',
    })
    expect(checkLikeStatus).toHaveBeenCalledWith({
      targetType: 3,
      targetId: 101,
      userId: 5,
    })
    expect(checkFavoriteStatus).toHaveBeenCalledWith({
      targetType: 3,
      targetId: 101,
      userId: 5,
    })
    expect(checkFollowStatus).toHaveBeenCalledWith({
      targetType: 1,
      targetId: 7,
      userId: 5,
    })
    expect(result).toEqual(
      expect.objectContaining({
        id: 101,
        liked: true,
        favorited: false,
        user: {
          id: 7,
          nickname: '详情作者',
          avatarUrl: 'https://example.com/avatar.png',
          isFollowed: true,
        },
      }),
    )
  })
})
