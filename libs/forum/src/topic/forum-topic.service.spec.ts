/// <reference types="jest" />

import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'

// Mock the problematic emoji-parser dependency before importing ForumTopicService
jest.mock('@libs/interaction/emoji/emoji-parser.service', () => ({
  EmojiParserService: class MockEmojiParserService {},
}))

import { ForumTopicService } from './forum-topic.service'

/**
 * 最小化 mock 工厂。
 * 仅提供 ForumTopicService 实例化所需的依赖 stub，
 * 不创建真实 Drizzle 连接或 NestJS 容器。
 */
function createMockDrizzle() {
  return {
    query: {
      forumTopic: { findFirst: jest.fn(), findMany: jest.fn() },
      forumSection: { findMany: jest.fn() },
    },
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    insert: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn((fn) =>
      fn({
        query: {
          forumTopic: { findFirst: jest.fn(), findMany: jest.fn() },
          forumSection: { findMany: jest.fn() },
        },
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        insert: jest.fn(),
        execute: jest.fn(),
      }),
    ),
  }
}

function createChainQuery<T = unknown>(result: T) {
  const chain = {
    catch: jest.fn((onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    ),
    finally: jest.fn((onFinally?: () => void) =>
      Promise.resolve(result).finally(onFinally),
    ),
    from: jest.fn(() => chain),
    groupBy: jest.fn(() => Promise.resolve(result)),
    limit: jest.fn(() => chain),
    offset: jest.fn(() => chain),
    orderBy: jest.fn(() => Promise.resolve(result)),
    then: jest.fn(
      (
        onFulfilled?: (value: T) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
    ),
    where: jest.fn(() => chain),
  }

  return chain
}

function createUpdateQuery(result: unknown = []) {
  const chain = {
    set: jest.fn(() => chain),
    where: jest.fn(() => Promise.resolve(result)),
  }

  return chain
}

function createColumn(name: string) {
  return {
    name,
    table: {
      [Symbol.for('drizzle:Name')]: name.split('.')[0] ?? 'mock_table',
      [Symbol.for('drizzle:Schema')]: undefined,
      [Symbol.for('drizzle:IsAlias')]: false,
    },
  }
}

function createTable<T extends Record<string, unknown>>(
  name: string,
  columns: T,
) {
  return {
    ...columns,
    _: { selectedFields: columns },
    [Symbol.for('drizzle:Name')]: name,
    [Symbol.for('drizzle:OriginalName')]: name,
    [Symbol.for('drizzle:Schema')]: undefined,
    [Symbol.for('drizzle:IsAlias')]: false,
    [Symbol.for('drizzle:IsDrizzleTable')]: true,
  }
}

function collectSqlText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  if ('value' in value && Array.isArray((value as { value: unknown }).value)) {
    return (value as { value: string[] }).value.join('')
  }

  if (
    'name' in value &&
    typeof (value as { name: unknown }).name === 'string'
  ) {
    return (value as { name: string }).name
  }

  if (
    'queryChunks' in value &&
    Array.isArray((value as { queryChunks: unknown[] }).queryChunks)
  ) {
    return (value as { queryChunks: unknown[] }).queryChunks
      .map((chunk) => collectSqlText(chunk))
      .join(' ')
  }

  if (
    'getSQL' in value &&
    typeof (value as { getSQL: unknown }).getSQL === 'function'
  ) {
    return collectSqlText((value as { getSQL: () => unknown }).getSQL())
  }

  return ''
}

function createMockService(
  dbOverride?: ReturnType<typeof createMockDrizzle>,
  overrides?: {
    forumPermissionService?: Record<string, unknown>
    forumCounterService?: Record<string, unknown>
    appUserCountService?: Record<string, unknown>
    actionLogService?: Record<string, unknown>
    mentionService?: Record<string, unknown>
    forumHashtagReferenceService?: Record<string, unknown>
  },
) {
  const db = dbOverride ?? createMockDrizzle()
  const service = new ForumTopicService(
    /* drizzle */ {
      db,
      schema: {
        forumTopic: createTable('forum_topic', {
          id: createColumn('forumTopic.id'),
          sectionId: createColumn('forumTopic.sectionId'),
          userId: createColumn('forumTopic.userId'),
          auditStatus: createColumn('forumTopic.auditStatus'),
          isHidden: createColumn('forumTopic.isHidden'),
          isLocked: createColumn('forumTopic.isLocked'),
          isPinned: createColumn('forumTopic.isPinned'),
          isFeatured: createColumn('forumTopic.isFeatured'),
          deletedAt: createColumn('forumTopic.deletedAt'),
          viewCount: createColumn('forumTopic.viewCount'),
          likeCount: createColumn('forumTopic.likeCount'),
          commentCount: createColumn('forumTopic.commentCount'),
          favoriteCount: createColumn('forumTopic.favoriteCount'),
          lastCommentAt: createColumn('forumTopic.lastCommentAt'),
          createdAt: createColumn('forumTopic.createdAt'),
          updatedAt: createColumn('forumTopic.updatedAt'),
          content: createColumn('forumTopic.content'),
          body: createColumn('forumTopic.body'),
          bodyVersion: createColumn('forumTopic.bodyVersion'),
          auditById: createColumn('forumTopic.auditById'),
          auditRole: createColumn('forumTopic.auditRole'),
          auditReason: createColumn('forumTopic.auditReason'),
          auditAt: createColumn('forumTopic.auditAt'),
          version: createColumn('forumTopic.version'),
          sensitiveWordHits: createColumn('forumTopic.sensitiveWordHits'),
          contentPreview: createColumn('forumTopic.contentPreview'),
          geoCountry: createColumn('forumTopic.geoCountry'),
          geoProvince: createColumn('forumTopic.geoProvince'),
          geoCity: createColumn('forumTopic.geoCity'),
          geoIsp: createColumn('forumTopic.geoIsp'),
          geoSource: createColumn('forumTopic.geoSource'),
          images: createColumn('forumTopic.images'),
          videos: createColumn('forumTopic.videos'),
          html: createColumn('forumTopic.html'),
          title: createColumn('forumTopic.title'),
        }),
        userComment: createTable('user_comment', {
          id: createColumn('userComment.id'),
          targetType: createColumn('userComment.targetType'),
          targetId: createColumn('userComment.targetId'),
          userId: createColumn('userComment.userId'),
          likeCount: createColumn('userComment.likeCount'),
          deletedAt: createColumn('userComment.deletedAt'),
        }),
        userFollow: createTable('user_follow', {
          id: createColumn('userFollow.id'),
          userId: createColumn('userFollow.userId'),
          targetType: createColumn('userFollow.targetType'),
          targetId: createColumn('userFollow.targetId'),
        }),
        forumHashtagReference: createTable('forum_hashtag_reference', {
          id: createColumn('forumHashtagReference.id'),
          topicId: createColumn('forumHashtagReference.topicId'),
          hashtagId: createColumn('forumHashtagReference.hashtagId'),
          sourceType: createColumn('forumHashtagReference.sourceType'),
          isSourceVisible: createColumn(
            'forumHashtagReference.isSourceVisible',
          ),
          sectionId: createColumn('forumHashtagReference.sectionId'),
        }),
      },
      buildPage: jest.fn((query) => ({
        limit: query.pageSize,
        offset: ((query.pageIndex ?? 1) - 1) * query.pageSize,
        pageIndex: query.pageIndex ?? 1,
        pageSize: query.pageSize,
      })),
      buildOrderBy: jest.fn(() => ({ orderBySql: [] })),
      assertAffectedRows: jest.fn((rows) => {
        if (Array.isArray(rows) && rows.length === 0) {
          throw new BusinessException(
            BusinessErrorCode.RESOURCE_NOT_FOUND,
            '主题不存在',
          )
        }
      }),
    } as any,
    /* growthEventBridgeService */ {} as any,
    /* growthBalanceQueryService */ {
      getUserGrowthSnapshot: jest.fn(async () => ({
        points: 100,
        experience: 500,
        levelId: 1,
      })),
    } as any,
    /* sensitiveWordDetectService */ {} as any,
    /* browseLogService */ {
      recordBrowseLogSafely: jest.fn(),
    } as any,
    /* forumCounterService */ {
      syncSectionVisibleState: jest.fn(async () => {}),
      updateUserForumTopicCount: jest.fn(async () => {}),
      updateUserForumTopicReceivedLikeCount: jest.fn(async () => {}),
      updateUserForumTopicReceivedFavoriteCount: jest.fn(async () => {}),
      ...(overrides?.forumCounterService ?? {}),
    } as any,
    /* appUserCountService */ {
      updateCommentCount: jest.fn(async () => {}),
      updateCommentReceivedLikeCount: jest.fn(async () => {}),
      ...(overrides?.appUserCountService ?? {}),
    } as any,
    /* actionLogService */ {
      createActionLogInTx: jest.fn(async () => {}),
      ...(overrides?.actionLogService ?? {}),
    } as any,
    /* forumPermissionService */ {
      isSectionPubliclyAvailable: jest.fn(() => true),
      ensureUserCanAccessSection: jest.fn(async () => {}),
      getAccessibleSectionIds: jest.fn(async () => [10, 20]),
      ...(overrides?.forumPermissionService ?? {}),
    } as any,
    /* likeService */ {
      isLiked: jest.fn(async () => false),
    } as any,
    /* favoriteService */ {
      isFavorited: jest.fn(async () => false),
    } as any,
    /* followService */ {
      isFollowed: jest.fn(async () => false),
    } as any,
    /* bodyHtmlCodecService */ {} as any,
    /* bodyCompilerService */ {} as any,
    /* mentionService */ {
      deleteMentionsInTx: jest.fn(async () => {}),
      deleteCommentMentionsByForumTopicInTx: jest.fn(async () => {}),
      ...(overrides?.mentionService ?? {}),
    } as any,
    /* emojiCatalogService */ {} as any,
    /* sensitiveWordStatisticsService */ {} as any,
    /* forumHashtagBodyService */ {} as any,
    /* forumHashtagReferenceService */ {
      deleteReferencesInTx: jest.fn(async () => {}),
      deleteCommentReferencesByTopicInTx: jest.fn(async () => {}),
      ...(overrides?.forumHashtagReferenceService ?? {}),
    } as any,
    /* interactionSummaryReadService */ {} as any,
  )

  return service
}

// ---------------------------------------------------------------------------
// F-01: materializeTopicBodyInTx — 正文为空时抛 BusinessException
// ---------------------------------------------------------------------------
describe('ForumTopicService — materializeTopicBodyInTx (F-01)', () => {
  it('当 html 为空字符串时抛出 BusinessException(OPERATION_NOT_ALLOWED)', async () => {
    const service = createMockService()
    await expect(
      (service as any).materializeTopicBodyInTx(
        {
          /* tx */
        } as any,
        { html: '   ' } as any,
        1,
      ),
    ).rejects.toThrow(BusinessException)

    try {
      await (service as any).materializeTopicBodyInTx(
        {} as any,
        { html: '' } as any,
        1,
      )
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessException)
      expect((e as BusinessException).code).toBe(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// F-02: updateUserTopic / deleteUserTopic — 权限不足抛 BusinessException
// ---------------------------------------------------------------------------
describe('ForumTopicService — updateUserTopic / deleteUserTopic (F-02)', () => {
  it('updateUserTopic 非主题作者抛出 BusinessException(OPERATION_NOT_ALLOWED)', async () => {
    const service = createMockService()
    const topic = {
      id: 1,
      userId: 100,
      auditStatus: 1,
      isLocked: false,
      deletedAt: null,
    }
    ;(service as any).getActiveTopicOrThrow = jest.fn(async () => topic)
    ;(service as any).updateTopicWithCurrent = jest.fn()

    await expect(
      service.updateUserTopic(999, { id: 1, title: 'test' } as any),
    ).rejects.toThrow(BusinessException)

    try {
      await service.updateUserTopic(999, { id: 1, title: 'test' } as any)
    } catch (e) {
      expect((e as BusinessException).code).toBe(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
      )
    }
  })

  it('deleteUserTopic 非主题作者抛出 BusinessException(OPERATION_NOT_ALLOWED)', async () => {
    const service = createMockService()
    const topic = {
      id: 1,
      userId: 100,
      auditStatus: 1,
      isLocked: false,
      deletedAt: null,
    }
    ;(service as any).getActiveTopicOrThrow = jest.fn(async () => topic)
    ;(service as any).deleteTopicWithCurrent = jest.fn()

    await expect(service.deleteUserTopic(999, 1)).rejects.toThrow(
      BusinessException,
    )

    try {
      await service.deleteUserTopic(999, 1)
    } catch (e) {
      expect((e as BusinessException).code).toBe(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// F-07: getTopicSectionBriefMap — requireEnabled 条件分支验证
// ---------------------------------------------------------------------------
describe('ForumTopicService — getTopicSectionBriefMap (F-07)', () => {
  it('requireEnabled=false 时不注入 isEnabled 条件', async () => {
    const findManyMock = jest.fn(async () => [
      {
        id: 1,
        name: '板块1',
        icon: null,
        cover: null,
        groupId: null,
        deletedAt: null,
        isEnabled: true,
        group: null,
      },
    ])
    const db = createMockDrizzle()
    db.query.forumSection.findMany = findManyMock
    const service = createMockService(db)

    await (service as any).getTopicSectionBriefMap([1], {
      requireEnabled: false,
    })

    const callArgs = (findManyMock.mock.calls[0] as any[])?.[0]
    expect(callArgs?.where).not.toHaveProperty('isEnabled', true)
    // baseWhere 仅含 id + deletedAt
    expect(callArgs?.where).toHaveProperty('id')
    expect(callArgs?.where).toHaveProperty('deletedAt')
  })

  it('requireEnabled=true 时注入 isEnabled: true', async () => {
    const findManyMock = jest.fn(async () => [
      {
        id: 1,
        name: '板块1',
        icon: null,
        cover: null,
        groupId: null,
        deletedAt: null,
        isEnabled: true,
        group: null,
      },
    ])
    const db = createMockDrizzle()
    db.query.forumSection.findMany = findManyMock
    const service = createMockService(db)

    await (service as any).getTopicSectionBriefMap([1], {
      requireEnabled: true,
    })

    const callArgs = (findManyMock.mock.calls[0] as any[])?.[0]
    expect(callArgs?.where).toHaveProperty('isEnabled', true)
  })
})

// ---------------------------------------------------------------------------
// F-08: getPublicTopicById — viewCount 不含手动 +1
// ---------------------------------------------------------------------------
describe('ForumTopicService — getPublicTopicById viewCount (F-08)', () => {
  it('返回的 viewCount 等于数据库快照值，不含手动 +1', async () => {
    const topicFromDb = {
      id: 1,
      sectionId: 10,
      userId: 100,
      title: '测试主题',
      html: '<p>test</p>',
      content: 'test',
      contentPreview: [],
      body: {},
      bodyVersion: 1,
      images: [],
      videos: [],
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: 1,
      auditReason: null,
      auditAt: null,
      auditById: null,
      auditRole: null,
      viewCount: 42,
      likeCount: 5,
      commentCount: 3,
      favoriteCount: 2,
      lastCommentAt: null,
      lastCommentUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      version: 0,
      sensitiveWordHits: null,
      section: {
        id: 10,
        name: '板块',
        groupId: null,
        deletedAt: null,
        isEnabled: true,
        group: null,
        icon: null,
        cover: null,
        topicCount: 100,
        followersCount: 50,
      },
      user: {
        id: 100,
        nickname: '用户',
        avatarUrl: '',
        signature: '',
        bio: '',
        isEnabled: true,
        levelId: 1,
        status: 1,
        banReason: null,
        banUntil: null,
        counts: null,
        level: null,
      },
    }

    const db = createMockDrizzle()
    db.query.forumTopic.findFirst = jest.fn(async () => topicFromDb)
    const service = createMockService(db)

    // buildPublicTopicDetail 是 private 方法，getPublicTopicById 调用它
    // 需要额外 stub getTopicHashtags 和 getTopicAuditorSummary
    ;(service as any).getTopicHashtags = jest.fn(async () => [])
    ;(service as any).getTopicAuditorSummary = jest.fn(async () => null)

    const result = await (service as any).getPublicTopicById(1, 200)
    expect(result.viewCount).toBe(42)
  })
})

describe('ForumTopicService — 关注 feed 性能查询形态', () => {
  it('关注 hashtag 时把过滤并入分页查询，不再先物化 topicId 大数组', async () => {
    const followsQuery = createChainQuery([{ targetType: 4, targetId: 1001 }])
    const hashtagExistsQuery = createChainQuery([])
    const topicListQuery = createChainQuery([])
    const db = createMockDrizzle()
    db.select = jest
      .fn()
      .mockReturnValueOnce(followsQuery)
      .mockReturnValueOnce(hashtagExistsQuery)
      .mockReturnValueOnce(topicListQuery)
    ;(db as any).$count = jest.fn(async () => 0)

    const service = createMockService(db, {
      forumPermissionService: {
        getAccessibleSectionIds: jest.fn(async () => [10, 20]),
      },
    })

    const result = await service.getFollowingPublicTopics({
      pageIndex: 1,
      pageSize: 20,
      userId: 9,
    })

    expect(result).toEqual({ list: [], total: 0, pageIndex: 1, pageSize: 20 })
    expect(db.select).toHaveBeenCalledTimes(3)
    expect(followsQuery.where).toHaveBeenCalledTimes(1)
    expect(hashtagExistsQuery.where).toHaveBeenCalledTimes(1)
    expect(topicListQuery.where).toHaveBeenCalledTimes(1)
    const hashtagWhereSql = collectSqlText(
      hashtagExistsQuery.where.mock.calls[0][0],
    )
    const whereSql = collectSqlText(topicListQuery.where.mock.calls[0][0])
    expect(hashtagWhereSql).toContain('forumHashtagReference.topicId')
    expect(whereSql).toContain('exists')
  })

  it('未关注 hashtag 时不生成 hashtag exists 子查询', async () => {
    const followsQuery = createChainQuery([{ targetType: 1, targetId: 100 }])
    const topicListQuery = createChainQuery([])
    const db = createMockDrizzle()
    db.select = jest
      .fn()
      .mockReturnValueOnce(followsQuery)
      .mockReturnValueOnce(topicListQuery)
    ;(db as any).$count = jest.fn(async () => 0)

    const service = createMockService(db, {
      forumPermissionService: {
        getAccessibleSectionIds: jest.fn(async () => [10]),
      },
    })

    await service.getFollowingPublicTopics({
      pageIndex: 1,
      pageSize: 20,
      userId: 9,
    })

    const whereSql = collectSqlText(topicListQuery.where.mock.calls[0][0])
    expect(whereSql).not.toContain('exists')
  })
})

describe('ForumTopicService — deleteTopicWithCurrentInTx 性能路径', () => {
  it('删除主题使用数据库侧用户聚合和按 topic 清理评论事实', async () => {
    const commentSummaryRows = [
      { userId: 100, commentCount: 2, receivedLikeCount: 3 },
      { userId: 101, commentCount: 1, receivedLikeCount: 0 },
    ]
    const aggregateQuery = createChainQuery(commentSummaryRows)
    const commentUpdate = createUpdateQuery([{ id: 1 }])
    const topicUpdate = createUpdateQuery([{ id: 1 }])
    const tx = {
      query: {
        userComment: { findMany: jest.fn() },
      },
      select: jest.fn(() => aggregateQuery),
      update: jest
        .fn()
        .mockReturnValueOnce(commentUpdate)
        .mockReturnValueOnce(topicUpdate),
    }
    const forumCounterService = {
      syncSectionVisibleState: jest.fn(async () => {}),
      updateUserForumTopicCount: jest.fn(async () => {}),
      updateUserForumTopicReceivedLikeCount: jest.fn(async () => {}),
      updateUserForumTopicReceivedFavoriteCount: jest.fn(async () => {}),
    }
    const appUserCountService = {
      updateCommentCount: jest.fn(async () => {}),
      updateCommentReceivedLikeCount: jest.fn(async () => {}),
    }
    const actionLogService = {
      createActionLogInTx: jest.fn(async () => {}),
    }
    const mentionService = {
      deleteMentionsInTx: jest.fn(async () => {}),
      deleteCommentMentionsByForumTopicInTx: jest.fn(async () => {}),
    }
    const forumHashtagReferenceService = {
      deleteReferencesInTx: jest.fn(async () => {}),
      deleteCommentReferencesByTopicInTx: jest.fn(async () => {}),
    }
    const service = createMockService(undefined, {
      forumCounterService,
      appUserCountService,
      actionLogService,
      mentionService,
      forumHashtagReferenceService,
    })

    await service.deleteTopicWithCurrentInTx(
      tx as any,
      {
        id: 1,
        sectionId: 10,
        userId: 99,
        likeCount: 5,
        favoriteCount: 4,
      } as any,
    )

    expect(tx.query.userComment.findMany).not.toHaveBeenCalled()
    expect(aggregateQuery.groupBy).toHaveBeenCalled()
    expect(
      mentionService.deleteCommentMentionsByForumTopicInTx,
    ).toHaveBeenCalledWith(tx, 1)
    expect(
      forumHashtagReferenceService.deleteCommentReferencesByTopicInTx,
    ).toHaveBeenCalledWith(tx, 1)
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      100,
      -2,
    )
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledWith(tx, 100, -3)
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      101,
      -1,
    )
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 主题不存在 — BusinessException(RESOURCE_NOT_FOUND)
// ---------------------------------------------------------------------------
describe('ForumTopicService — 主题不存在抛出 BusinessException(RESOURCE_NOT_FOUND)', () => {
  it('getTopicById 不透传 DTO 外部字段', async () => {
    const topicFromDb = {
      id: 1,
      sectionId: 10,
      userId: 100,
      lastCommentUserId: null,
      auditById: 300,
      title: '后台详情主题',
      html: '<p>detail</p>',
      content: 'detail',
      contentPreview: { text: 'detail', segments: [] },
      body: { type: 'doc' },
      bodyVersion: 1,
      images: [],
      videos: [],
      isPinned: false,
      isFeatured: false,
      isLocked: false,
      isHidden: false,
      auditStatus: 1,
      auditRole: 1,
      auditReason: null,
      auditAt: null,
      version: 0,
      sensitiveWordHits: null,
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
      viewCount: 42,
      likeCount: 5,
      commentCount: 3,
      favoriteCount: 2,
      lastCommentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      section: {
        id: 10,
        name: '板块',
        description: null,
        icon: null,
        cover: null,
        isEnabled: true,
        topicReviewPolicy: 1,
      },
      user: {
        id: 100,
        nickname: '作者',
        avatarUrl: null,
        signature: null,
        bio: null,
        isEnabled: true,
        points: 0,
        levelId: null,
        status: 1,
        banReason: null,
        banUntil: null,
        counts: null,
        level: null,
      },
    }

    const db = createMockDrizzle()
    db.query.forumTopic.findFirst = jest.fn(async () => topicFromDb)
    const service = createMockService(db)
    ;(service as any).getTopicHashtags = jest.fn(async () => [])
    ;(service as any).getTopicAuditorSummary = jest.fn(async () => null)

    const result = await service.getTopicById(1)

    expect(result).toMatchObject({
      id: 1,
      sectionId: 10,
      userId: 100,
      title: '后台详情主题',
      html: '<p>detail</p>',
      viewCount: 42,
      section: expect.objectContaining({
        id: 10,
        name: '板块',
      }),
      user: expect.objectContaining({
        id: 100,
        counts: null,
        level: null,
      }),
      auditorSummary: null,
    })
    expect(result).not.toHaveProperty('content')
    expect(result).not.toHaveProperty('contentPreview')
    expect(result).not.toHaveProperty('body')
    expect(result).not.toHaveProperty('bodyVersion')
    expect(result).not.toHaveProperty('auditById')
    expect(result).not.toHaveProperty('auditRole')
    expect(result).not.toHaveProperty('geoCountry')
    expect(result).not.toHaveProperty('geoProvince')
    expect(result).not.toHaveProperty('geoCity')
    expect(result).not.toHaveProperty('geoIsp')
    expect(result).not.toHaveProperty('geoSource')
    expect(result).not.toHaveProperty('deletedAt')
  })

  it('getTopicById 主题缺失板块时抛出 BusinessException', async () => {
    const db = createMockDrizzle()
    db.query.forumTopic.findFirst = jest.fn(async () => ({
      id: 1,
      section: null,
    }))
    const service = createMockService(db)

    await expect(service.getTopicById(1)).rejects.toThrow(BusinessException)

    try {
      await service.getTopicById(1)
    } catch (e) {
      expect((e as BusinessException).code).toBe(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
      )
    }
  })

  it('getTopicById 主题不存在时抛出 BusinessException', async () => {
    const db = createMockDrizzle()
    db.query.forumTopic.findFirst = jest.fn(async () => null)
    const service = createMockService(db)

    await expect(service.getTopicById(9999)).rejects.toThrow(BusinessException)

    try {
      await service.getTopicById(9999)
    } catch (e) {
      expect((e as BusinessException).code).toBe(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
      )
    }
  })
})
