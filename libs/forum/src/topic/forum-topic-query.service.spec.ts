/// <reference types="jest" />

jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm')
  const condition = (op: string, ...args: unknown[]) => ({ args, op })

  return {
    ...actual,
    and: jest.fn((...conditions: unknown[]) => ({
      conditions,
      op: 'and',
    })),
    eq: jest.fn((left: unknown, right: unknown) =>
      condition('eq', left, right),
    ),
    exists: jest.fn((query: unknown) => ({ op: 'exists', query })),
    getColumns: jest.fn((table: { columns?: Record<string, unknown> }) =>
      table.columns ? table.columns : {},
    ),
    ilike: jest.fn((left: unknown, right: unknown) =>
      condition('ilike', left, right),
    ),
    inArray: jest.fn((left: unknown, right: unknown) =>
      condition('inArray', left, right),
    ),
    isNull: jest.fn((value: unknown) => condition('isNull', value)),
    isNotNull: jest.fn((value: unknown) => condition('isNotNull', value)),
    or: jest.fn((...conditions: unknown[]) => ({ conditions, op: 'or' })),
  }
})

import { AuditStatusEnum, BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { exists, or } from 'drizzle-orm'
import { ForumTopicDeletedStateEnum } from './dto/forum-topic.dto'
import { ForumTopicQueryService } from './forum-topic-query.service'

type BusinessErrorCodeValue =
  (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode]
type QueryServiceConstructorArgs = ConstructorParameters<
  typeof ForumTopicQueryService
>

interface SelectBuilderState {
  from?: unknown
  innerJoin?: unknown[]
  orderBy?: unknown[]
  selection?: unknown
  where?: unknown
}

interface SelectBuilder<TResult> extends PromiseLike<TResult> {
  from: ReturnType<typeof jest.fn>
  groupBy: ReturnType<typeof jest.fn>
  innerJoin: ReturnType<typeof jest.fn>
  limit: ReturnType<typeof jest.fn>
  offset: ReturnType<typeof jest.fn>
  orderBy: ReturnType<typeof jest.fn>
  state: SelectBuilderState
  where: ReturnType<typeof jest.fn>
}

// 构造 Drizzle 链式 select mock，记录 where/from/orderBy 形状。
function createSelectBuilder<TResult>(
  result: TResult,
  selection?: unknown,
): SelectBuilder<TResult> {
  const state: SelectBuilderState = { selection }
  const promise = Promise.resolve(result)
  const builder = {
    from: jest.fn((table: unknown) => {
      state.from = table
      return builder
    }),
    groupBy: jest.fn((...columns: unknown[]) => {
      state.orderBy = columns
      return promise
    }),
    innerJoin: jest.fn((table: unknown, condition: unknown) => {
      state.innerJoin = [table, condition]
      return builder
    }),
    limit: jest.fn(() => builder),
    offset: jest.fn(() => builder),
    orderBy: jest.fn((...orderBy: unknown[]) => {
      state.orderBy = orderBy
      return promise
    }),
    state,
    then: promise.then.bind(promise),
    where: jest.fn((conditionValue: unknown) => {
      state.where = conditionValue
      return builder
    }),
  }

  return builder
}

function asDependency<T>(value: unknown): T {
  return value as T
}

function createColumn(name: string) {
  return { name }
}

function createTable<TColumns extends Record<string, unknown>>(
  name: string,
  columns: TColumns,
) {
  return {
    ...columns,
    columns,
    name,
  }
}

function createForumTopicColumns() {
  return {
    auditAt: createColumn('forum_topic.audit_at'),
    auditById: createColumn('forum_topic.audit_by_id'),
    auditReason: createColumn('forum_topic.audit_reason'),
    auditRole: createColumn('forum_topic.audit_role'),
    auditStatus: createColumn('forum_topic.audit_status'),
    body: createColumn('forum_topic.body'),
    bodyVersion: createColumn('forum_topic.body_version'),
    commentCount: createColumn('forum_topic.comment_count'),
    content: createColumn('forum_topic.content'),
    contentPreview: createColumn('forum_topic.content_preview'),
    createdAt: createColumn('forum_topic.created_at'),
    deletedAt: createColumn('forum_topic.deleted_at'),
    favoriteCount: createColumn('forum_topic.favorite_count'),
    geoCity: createColumn('forum_topic.geo_city'),
    geoCountry: createColumn('forum_topic.geo_country'),
    geoIsp: createColumn('forum_topic.geo_isp'),
    geoProvince: createColumn('forum_topic.geo_province'),
    geoSource: createColumn('forum_topic.geo_source'),
    html: createColumn('forum_topic.html'),
    id: createColumn('forum_topic.id'),
    images: createColumn('forum_topic.images'),
    isFeatured: createColumn('forum_topic.is_featured'),
    isHidden: createColumn('forum_topic.is_hidden'),
    isLocked: createColumn('forum_topic.is_locked'),
    isPinned: createColumn('forum_topic.is_pinned'),
    lastCommentAt: createColumn('forum_topic.last_comment_at'),
    lastCommentUserId: createColumn('forum_topic.last_comment_user_id'),
    likeCount: createColumn('forum_topic.like_count'),
    sectionId: createColumn('forum_topic.section_id'),
    sensitiveWordHits: createColumn('forum_topic.sensitive_word_hits'),
    title: createColumn('forum_topic.title'),
    updatedAt: createColumn('forum_topic.updated_at'),
    userId: createColumn('forum_topic.user_id'),
    version: createColumn('forum_topic.version'),
    videos: createColumn('forum_topic.videos'),
    viewCount: createColumn('forum_topic.view_count'),
  }
}

function createSchema() {
  return {
    appUser: createTable('app_user', {
      avatarUrl: createColumn('app_user.avatar_url'),
      id: createColumn('app_user.id'),
      nickname: createColumn('app_user.nickname'),
    }),
    forumHashtag: createTable('forum_hashtag', {
      commentRefCount: createColumn('forum_hashtag.comment_ref_count'),
      deletedAt: createColumn('forum_hashtag.deleted_at'),
      description: createColumn('forum_hashtag.description'),
      displayName: createColumn('forum_hashtag.display_name'),
      followerCount: createColumn('forum_hashtag.follower_count'),
      id: createColumn('forum_hashtag.id'),
      lastReferencedAt: createColumn('forum_hashtag.last_referenced_at'),
      slug: createColumn('forum_hashtag.slug'),
      topicRefCount: createColumn('forum_hashtag.topic_ref_count'),
    }),
    forumHashtagReference: createTable('forum_hashtag_reference', {
      createdAt: createColumn('forum_hashtag_reference.created_at'),
      hashtagId: createColumn('forum_hashtag_reference.hashtag_id'),
      id: createColumn('forum_hashtag_reference.id'),
      isSourceVisible: createColumn(
        'forum_hashtag_reference.is_source_visible',
      ),
      sourceId: createColumn('forum_hashtag_reference.source_id'),
      sourceType: createColumn('forum_hashtag_reference.source_type'),
      topicId: createColumn('forum_hashtag_reference.topic_id'),
    }),
    forumSection: createTable('forum_section', {
      cover: createColumn('forum_section.cover'),
      deletedAt: createColumn('forum_section.deleted_at'),
      groupId: createColumn('forum_section.group_id'),
      icon: createColumn('forum_section.icon'),
      id: createColumn('forum_section.id'),
      isEnabled: createColumn('forum_section.is_enabled'),
      name: createColumn('forum_section.name'),
      topicReviewPolicy: createColumn('forum_section.topic_review_policy'),
    }),
    forumTopic: createTable('forum_topic', createForumTopicColumns()),
    userFollow: createTable('user_follow', {
      id: createColumn('user_follow.id'),
      targetId: createColumn('user_follow.target_id'),
      targetType: createColumn('user_follow.target_type'),
      userId: createColumn('user_follow.user_id'),
    }),
  }
}

function createQueryService(options?: {
  findFirstTopic?: unknown
  selectResults?: unknown[]
}) {
  const schema = createSchema()
  const selectBuilders: SelectBuilder<unknown>[] = []
  const db = {
    $count: jest.fn(async () => 0),
    query: {
      appUser: { findMany: jest.fn(async () => []) },
      forumSection: {
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
      },
      forumTopic: {
        findFirst: jest.fn(async () => options?.findFirstTopic),
      },
    },
    select: jest.fn((selection?: unknown) => {
      const result = options?.selectResults?.shift() ?? []
      const builder = createSelectBuilder(result, selection)
      selectBuilders.push(builder)
      return builder
    }),
  }
  const drizzle = {
    buildOrderBy: jest.fn(
      (
        orderBy: unknown,
        config: { fallbackOrderBy: unknown[]; table: unknown },
      ) => ({
        orderBySql: config.fallbackOrderBy,
        orderBy,
      }),
    ),
    buildAllowlistedOrderBy: jest.fn((orderBy: unknown) => ({
      orderBySql: ['allowlisted_order'],
      orderBy,
    })),
    buildPage: jest.fn((query: { pageIndex?: number; pageSize?: number }) => ({
      limit: query.pageSize ?? 20,
      offset: ((query.pageIndex ?? 1) - 1) * (query.pageSize ?? 20),
      pageIndex: query.pageIndex ?? 1,
      pageSize: query.pageSize ?? 20,
    })),
    buildPageParams: jest.fn(
      (query: { pageIndex?: number; pageSize?: number; orderBy?: string }) => ({
        page: {
          limit: query.pageSize ?? 20,
          offset: ((query.pageIndex ?? 1) - 1) * (query.pageSize ?? 20),
          pageIndex: query.pageIndex ?? 1,
          pageSize: query.pageSize ?? 20,
        },
        order: {
          orderBy: query.orderBy,
          orderBySql: ['allowlisted_order'],
        },
        dateRange: undefined,
      }),
    ),
    db,
    schema,
  }
  const forumPermissionService = {
    ensureUserCanAccessSection: jest.fn(async () => undefined),
    getAccessibleSectionIds: jest.fn(async () => [10, 20]),
    isSectionPubliclyAvailable: jest.fn(() => true),
  }
  const followService = {
    checkFollowStatus: jest.fn(),
    checkStatusBatch: jest.fn(),
    getFollowTargetIds: jest.fn(),
  }
  const interactionSummaryReadService = {
    buildAuditorSummaryKey: jest.fn(() => null),
    getAuditorSummaryMap: jest.fn(async () => new Map()),
  }
  const growthBalanceQueryService = {
    getUserGrowthSnapshot: jest.fn(async () => ({ points: 88 })),
  }
  const service = new ForumTopicQueryService(
    asDependency<QueryServiceConstructorArgs[0]>(drizzle),
    asDependency<QueryServiceConstructorArgs[1]>(forumPermissionService),
    asDependency<QueryServiceConstructorArgs[2]>({}),
    asDependency<QueryServiceConstructorArgs[3]>({}),
    asDependency<QueryServiceConstructorArgs[4]>({}),
    asDependency<QueryServiceConstructorArgs[5]>({}),
    asDependency<QueryServiceConstructorArgs[6]>({}),
    asDependency<QueryServiceConstructorArgs[7]>({}),
    asDependency<QueryServiceConstructorArgs[8]>({}),
    asDependency<QueryServiceConstructorArgs[9]>(interactionSummaryReadService),
    asDependency<QueryServiceConstructorArgs[10]>(growthBalanceQueryService),
    asDependency<QueryServiceConstructorArgs[11]>({
      recordBrowseLogSafely: jest.fn(),
    }),
    asDependency<QueryServiceConstructorArgs[12]>({
      checkLikeStatus: jest.fn(async () => false),
      checkStatusBatch: jest.fn(async () => new Map()),
    }),
    asDependency<QueryServiceConstructorArgs[13]>({
      checkFavoriteStatus: jest.fn(async () => false),
      checkStatusBatch: jest.fn(async () => new Map()),
    }),
    asDependency<QueryServiceConstructorArgs[14]>(followService),
  )

  return {
    db,
    drizzle,
    followService,
    forumPermissionService,
    growthBalanceQueryService,
    schema,
    selectBuilders,
    service,
  }
}

function serializeShape(value: unknown) {
  return JSON.stringify(value, (_key, currentValue: unknown) =>
    typeof currentValue === 'function' ? '[function]' : currentValue,
  )
}

async function expectBusinessCode(
  promise: Promise<unknown>,
  code: BusinessErrorCodeValue,
) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('ForumTopicQueryService pagination order', () => {
  it('uses stable fallback order for public, hot and admin pages', async () => {
    const { drizzle, service } = createQueryService()

    await service.getPublicTopics({ pageSize: 20 })
    await service.getHotPublicTopics({ pageSize: 20 })
    await service.getTopics({ pageIndex: 1, pageSize: 20 })

    expect(drizzle.buildPageParams).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pageSize: 20 }),
      expect.objectContaining({
        allowlistedOrderBy: expect.objectContaining({
          fallbackOrderBy: [
            { isPinned: 'desc' },
            { lastCommentAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        }),
      }),
    )
    expect(drizzle.buildPageParams).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageSize: 20 }),
      expect.objectContaining({
        allowlistedOrderBy: expect.objectContaining({
          fallbackOrderBy: [
            { commentCount: 'desc' },
            { likeCount: 'desc' },
            { viewCount: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        }),
      }),
    )
    expect(drizzle.buildOrderBy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        fallbackOrderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })

  it('uses endpoint allowlist for explicit public orderBy', async () => {
    const { drizzle, service } = createQueryService()

    await service.getPublicTopics({
      orderBy: '{"createdAt":"asc"}',
      pageSize: 20,
    })

    expect(drizzle.buildPageParams).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: '{"createdAt":"asc"}',
      }),
      expect.objectContaining({
        allowlistedOrderBy: expect.objectContaining({
          columns: expect.objectContaining({
            createdAt: expect.anything(),
            id: expect.anything(),
            commentCount: expect.anything(),
            likeCount: expect.anything(),
            viewCount: expect.anything(),
          }),
        }),
      }),
    )
    expect(drizzle.buildOrderBy).not.toHaveBeenCalled()
  })

  it('rejects unsupported admin orderBy fields before querying', async () => {
    const { db, service } = createQueryService()

    await expectBusinessCode(
      service.getTopics({
        orderBy: '{"title":"desc"}',
        pageIndex: 1,
        pageSize: 20,
      }),
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    )
    expect(db.select).not.toHaveBeenCalled()
  })

  it('accepts deleted-state query contract for deleted admin list', async () => {
    const { service, selectBuilders } = createQueryService()

    await service.getTopics({
      deletedState: ForumTopicDeletedStateEnum.DELETED,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(serializeShape(selectBuilders.at(-1)?.state.where)).toContain(
      'isNotNull',
    )
  })
})

describe('ForumTopicQueryService following feed', () => {
  it('keeps follow filtering in DB-side exists subqueries', async () => {
    const { followService, selectBuilders, service } = createQueryService()

    await service.getFollowingPublicTopics({
      pageSize: 20,
      userId: 9,
    })

    expect(followService.checkFollowStatus).not.toHaveBeenCalled()
    expect(followService.checkStatusBatch).not.toHaveBeenCalled()
    expect(followService.getFollowTargetIds).not.toHaveBeenCalled()
    expect(exists).toHaveBeenCalledTimes(4)
    expect(or).toHaveBeenCalledTimes(1)
    expect(or).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'exists' }),
      expect.objectContaining({ op: 'exists' }),
      expect.objectContaining({ op: 'exists' }),
    )

    const mainListQuery = selectBuilders.at(-1)
    const whereShape = serializeShape(mainListQuery?.state.where)
    expect(whereShape).toContain('"op":"exists"')
    expect(whereShape).toContain('user_follow')
    expect(whereShape).toContain('forum_hashtag_reference')
  })
})

describe('ForumTopicQueryService admin detail mapper', () => {
  it('keeps nullable DTO fields explicit and normalizes unsafe JSON fields', async () => {
    const section = {
      cover: null,
      description: null,
      icon: null,
      id: 10,
      isEnabled: true,
      name: '综合讨论',
      topicReviewPolicy: 1,
    }
    const topic = {
      auditAt: undefined,
      auditById: null,
      auditReason: undefined,
      auditRole: null,
      auditStatus: AuditStatusEnum.APPROVED,
      body: { type: 'doc' },
      bodyVersion: 1,
      commentCount: 0,
      content: '正文',
      contentPreview: { plainText: '正文', segments: [] },
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
      favoriteCount: 0,
      geoCity: '深圳市',
      geoCountry: '中国',
      geoIsp: '电信',
      geoProvince: '广东省',
      geoSource: 'ip2region',
      html: '<p>正文</p>',
      id: 1,
      images: null,
      isFeatured: false,
      isHidden: false,
      isLocked: false,
      isPinned: false,
      lastCommentAt: undefined,
      lastCommentUserId: undefined,
      likeCount: 0,
      section,
      sectionId: section.id,
      sensitiveWordHits: [
        {
          end: 2,
          field: 'content',
          level: 1,
          replaceWord: null,
          start: 0,
          type: 1,
          word: '敏感词',
        },
        { word: 'invalid' },
      ],
      title: '后台详情',
      updatedAt: new Date('2026-06-01T01:00:00.000Z'),
      user: null,
      userId: 7,
      version: 0,
      videos: () => 'not-json',
      viewCount: 1,
    }
    const { service } = createQueryService({
      findFirstTopic: topic,
      selectResults: [[]],
    })

    const result = await service.getTopicById(1)

    expect(result.images).toEqual([])
    expect(result.videos).toEqual([])
    expect(result.auditReason).toBeNull()
    expect(result.auditAt).toBeNull()
    expect(result.lastCommentAt).toBeNull()
    expect(result.lastCommentUserId).toBeNull()
    expect(result.user).toBeNull()
    expect(result.auditorSummary).toBeNull()
    expect(result.sensitiveWordHits).toEqual([
      {
        end: 2,
        field: 'content',
        level: 1,
        replaceWord: null,
        start: 0,
        type: 1,
        word: '敏感词',
      },
    ])
    expect(result).not.toHaveProperty('content')
    expect(result.deletedAt).toBeNull()
  })

  it('throws stable not-found business code when admin detail is missing', async () => {
    const { service } = createQueryService({ findFirstTopic: null })

    await expectBusinessCode(
      service.getTopicById(404),
      BusinessErrorCode.RESOURCE_NOT_FOUND,
    )
    await expect(service.getTopicById(404)).rejects.toBeInstanceOf(
      BusinessException,
    )
  })
})
