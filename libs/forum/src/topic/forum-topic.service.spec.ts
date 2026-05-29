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
    transaction: jest.fn((fn) => fn({
      query: {
        forumTopic: { findFirst: jest.fn(), findMany: jest.fn() },
        forumSection: { findMany: jest.fn() },
      },
      select: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      insert: jest.fn(),
      execute: jest.fn(),
    })),
  }
}

function createMockService(dbOverride?: ReturnType<typeof createMockDrizzle>) {
  const db = dbOverride ?? createMockDrizzle()
  const service = new ForumTopicService(
    /* drizzle */ {
      db,
      schema: {
        forumTopic: {
          id: 'forumTopic.id',
          sectionId: 'forumTopic.sectionId',
          userId: 'forumTopic.userId',
          auditStatus: 'forumTopic.auditStatus',
          isHidden: 'forumTopic.isHidden',
          isLocked: 'forumTopic.isLocked',
          isPinned: 'forumTopic.isPinned',
          isFeatured: 'forumTopic.isFeatured',
          deletedAt: 'forumTopic.deletedAt',
          viewCount: 'forumTopic.viewCount',
          likeCount: 'forumTopic.likeCount',
          commentCount: 'forumTopic.commentCount',
          favoriteCount: 'forumTopic.favoriteCount',
          html: 'forumTopic.html',
          title: 'forumTopic.title',
        },
        userComment: { id: 'userComment.id' },
        userFollow: { id: 'userFollow.id' },
        forumHashtagReference: { id: 'forumHashtagReference.id' },
      },
    } as any,
    /* growthEventBridgeService */ {} as any,
    /* growthBalanceQueryService */ {
      getUserGrowthSnapshot: jest.fn(async () => ({ points: 100, experience: 500, levelId: 1 })),
    } as any,
    /* sensitiveWordDetectService */ {} as any,
    /* browseLogService */ {
      recordBrowseLogSafely: jest.fn(),
    } as any,
    /* forumCounterService */ {} as any,
    /* appUserCountService */ {} as any,
    /* actionLogService */ {} as any,
    /* forumPermissionService */ {
      isSectionPubliclyAvailable: jest.fn(() => true),
      ensureUserCanAccessSection: jest.fn(async () => {}),
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
    /* mentionService */ {} as any,
    /* emojiCatalogService */ {} as any,
    /* sensitiveWordStatisticsService */ {} as any,
    /* forumHashtagBodyService */ {} as any,
    /* forumHashtagReferenceService */ {} as any,
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
        { /* tx */ } as any,
        { html: '   ' } as any,
        1,
      ),
    ).rejects.toThrow(BusinessException)

    try {
      await (service as any).materializeTopicBodyInTx(
        { } as any,
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
    const topic = { id: 1, userId: 100, auditStatus: 1, isLocked: false, deletedAt: null }
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
    const topic = { id: 1, userId: 100, auditStatus: 1, isLocked: false, deletedAt: null }
    ;(service as any).getActiveTopicOrThrow = jest.fn(async () => topic)
    ;(service as any).deleteTopicWithCurrent = jest.fn()

    await expect(
      service.deleteUserTopic(999, 1),
    ).rejects.toThrow(BusinessException)

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
      { id: 1, name: '板块1', icon: null, cover: null, groupId: null, deletedAt: null, isEnabled: true, group: null },
    ])
    const db = createMockDrizzle()
    db.query.forumSection.findMany = findManyMock
    const service = createMockService(db)

    await (service as any).getTopicSectionBriefMap([1], { requireEnabled: false })

    const callArgs = (findManyMock.mock.calls[0] as any[])?.[0]
    expect(callArgs?.where).not.toHaveProperty('isEnabled', true)
    // baseWhere 仅含 id + deletedAt
    expect(callArgs?.where).toHaveProperty('id')
    expect(callArgs?.where).toHaveProperty('deletedAt')
  })

  it('requireEnabled=true 时注入 isEnabled: true', async () => {
    const findManyMock = jest.fn(async () => [
      { id: 1, name: '板块1', icon: null, cover: null, groupId: null, deletedAt: null, isEnabled: true, group: null },
    ])
    const db = createMockDrizzle()
    db.query.forumSection.findMany = findManyMock
    const service = createMockService(db)

    await (service as any).getTopicSectionBriefMap([1], { requireEnabled: true })

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

// ---------------------------------------------------------------------------
// 主题不存在 — BusinessException(RESOURCE_NOT_FOUND)
// ---------------------------------------------------------------------------
describe('ForumTopicService — 主题不存在抛出 BusinessException(RESOURCE_NOT_FOUND)', () => {
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
