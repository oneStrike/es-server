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
    isNotNull: jest.fn((value: unknown) => condition('isNotNull', value)),
    isNull: jest.fn((value: unknown) => condition('isNull', value)),
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      op: 'sql',
      sql: strings.join('?'),
      values,
    })),
  }
})

import type { Db } from '@db/core'
import type { ForumTopicSelect } from '@db/schema'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ForumTopicCommandService } from './forum-topic-command.service'

type BusinessErrorCodeValue =
  (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode]
type CommandServiceConstructorArgs = ConstructorParameters<
  typeof ForumTopicCommandService
>

type AsyncValueMock = jest.Mock<Promise<unknown>, []>

interface SelectBuilder<TResult> extends PromiseLike<TResult> {
  from: ReturnType<typeof jest.fn>
  groupBy: ReturnType<typeof jest.fn>
  limit: ReturnType<typeof jest.fn>
  state: {
    from?: unknown
    groupBy?: unknown[]
    limit?: number
    selection?: unknown
    where?: unknown
  }
  where: ReturnType<typeof jest.fn>
}

interface UpdateBuilder<TResult> {
  set: ReturnType<typeof jest.fn>
  state: {
    set?: unknown
    table?: unknown
    where?: unknown
  }
  where: ReturnType<typeof jest.fn>
}

interface CommandTx {
  execute: ReturnType<typeof jest.fn>
  query: {
    forumSection: { findFirst: AsyncValueMock }
    forumTopic: { findFirst: AsyncValueMock }
  }
  select: ReturnType<typeof jest.fn>
  update: ReturnType<typeof jest.fn>
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

function createSchema() {
  return {
    forumHashtagReference: createTable('forum_hashtag_reference', {
      id: createColumn('forum_hashtag_reference.id'),
    }),
    forumTopic: createTable('forum_topic', {
      deletedAt: createColumn('forum_topic.deleted_at'),
      id: createColumn('forum_topic.id'),
      sectionId: createColumn('forum_topic.section_id'),
    }),
    userComment: createTable('user_comment', {
      auditStatus: createColumn('user_comment.audit_status'),
      body: createColumn('user_comment.body'),
      deletedAt: createColumn('user_comment.deleted_at'),
      id: createColumn('user_comment.id'),
      isHidden: createColumn('user_comment.is_hidden'),
      likeCount: createColumn('user_comment.like_count'),
      targetId: createColumn('user_comment.target_id'),
      targetType: createColumn('user_comment.target_type'),
      topicDeleteCascadeId: createColumn(
        'user_comment.topic_delete_cascade_id',
      ),
      userId: createColumn('user_comment.user_id'),
    }),
  }
}

function createSelectBuilder<TResult>(
  result: TResult,
  selection?: unknown,
): SelectBuilder<TResult> {
  const state: SelectBuilder<TResult>['state'] = { selection }
  const promise = Promise.resolve(result)
  const builder = {
    from: jest.fn((table: unknown) => {
      state.from = table
      return builder
    }),
    groupBy: jest.fn((...columns: unknown[]) => {
      state.groupBy = columns
      return promise
    }),
    limit: jest.fn((limit: number) => {
      state.limit = limit
      return promise
    }),
    state,
    then: promise.then.bind(promise),
    where: jest.fn((condition: unknown) => {
      state.where = condition
      return builder
    }),
  }

  return builder
}

function createUpdateBuilder<TResult>(
  result: TResult,
  table?: unknown,
): UpdateBuilder<TResult> {
  const state: UpdateBuilder<TResult>['state'] = { table }
  const builder = {
    set: jest.fn((payload: unknown) => {
      state.set = payload
      return builder
    }),
    state,
    where: jest.fn((condition: unknown) => {
      state.where = condition
      return Promise.resolve(result)
    }),
  }

  return builder
}

function asDependency<T>(value: unknown): T {
  return value as T
}

function createTopic(overrides?: Partial<ForumTopicSelect>): ForumTopicSelect {
  return {
    auditAt: null,
    auditById: null,
    auditReason: null,
    auditRole: null,
    auditStatus: 1,
    body: {},
    bodyVersion: 1,
    commentCount: 0,
    content: '正文',
    contentPreview: { plainText: '正文', segments: [] },
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    deletedAt: null,
    favoriteCount: 0,
    geoCity: null,
    geoCountry: null,
    geoIsp: null,
    geoProvince: null,
    geoSource: null,
    html: '<p>正文</p>',
    id: 1,
    images: [],
    isFeatured: false,
    isHidden: false,
    isLocked: false,
    isPinned: false,
    lastCommentAt: null,
    lastCommentUserId: null,
    likeCount: 0,
    sectionId: 10,
    sensitiveWordHits: null,
    title: '主题',
    updatedAt: new Date('2026-06-01T01:00:00.000Z'),
    userId: 100,
    version: 0,
    videos: [],
    viewCount: 0,
    ...overrides,
  }
}

function createCommandService(options?: {
  assertAffectedRows?: (result: unknown, message: string) => void
  activeTopic?: ForumTopicSelect | null
  transactionTx?: CommandTx
}) {
  const schema = createSchema()
  const db = {
    query: {
      forumTopic: {
        findFirst: jest.fn(async () =>
          options && 'activeTopic' in options ? options.activeTopic : null,
        ),
      },
    },
    transaction: jest.fn(async (callback: (tx: CommandTx) => unknown) =>
      callback(options?.transactionTx ?? createCommandTx()),
    ),
  }
  const drizzle = {
    assertAffectedRows: options?.assertAffectedRows ?? jest.fn(() => undefined),
    db,
    schema,
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
  const forumPermissionService = {
    ensureUserCanCreateTopic: jest.fn(async () => undefined),
    isSectionPubliclyAvailable: jest.fn(() => true),
  }
  const forumCounterService = {
    syncSectionVisibleState: jest.fn(async () => undefined),
    updateUserForumTopicCount: jest.fn(async () => undefined),
    updateUserForumTopicReceivedFavoriteCount: jest.fn(async () => undefined),
    updateUserForumTopicReceivedLikeCount: jest.fn(async () => undefined),
  }
  const mentionService = {
    deleteCommentMentionsByForumTopicInTx: jest.fn(async () => undefined),
    deleteMentionsInTx: jest.fn(async () => undefined),
    dispatchTopicMentionsInTx: jest.fn(async () => undefined),
    replaceMentionsInTx: jest.fn(async () => undefined),
  }
  const forumHashtagReferenceService = {
    deleteCommentReferencesByTopicInTx: jest.fn(async () => undefined),
    deleteReferencesInTx: jest.fn(async () => undefined),
    replaceReferencesInTx: jest.fn(async () => undefined),
    syncCommentVisibilityByTopicInTx: jest.fn(async () => undefined),
    syncSectionIdsByTopicInTx: jest.fn(async () => undefined),
  }
  const appUserCountService = {
    updateCommentCount: jest.fn(async () => undefined),
    updateCommentReceivedLikeCount: jest.fn(async () => undefined),
  }
  const actionLogService = {
    createActionLog: jest.fn(async () => undefined),
    createActionLogInTx: jest.fn(async () => undefined),
  }
  const bodyHtmlCodecService = {
    parseHtmlOrThrow: jest.fn(() => ({ type: 'doc' })),
  }
  const sensitiveWordReviewPolicyService = {
    resolveTopicDecision: jest.fn(() => ({
      auditStatus: 1,
      isHidden: false,
      publicHits: [],
      recordHits: true,
      statisticsHits: [],
    })),
  }
  const bodyCompilerService = {
    compile: jest.fn(async () => ({
      body: { type: 'doc' },
      bodyTokens: [],
      contentPreview: { plainText: '正文', segments: [] },
      emojiRecentUsageItems: [],
      hashtagFacts: [],
      html: '<p>正文</p>',
      mentionFacts: [],
      plainText: '正文',
    })),
  }
  const forumHashtagBodyService = {
    materializeBodyInTx: jest.fn(async ({ body }: { body: unknown }) => ({
      body,
      hashtagFacts: [{ hashtagId: 7, occurrenceCount: 1 }],
    })),
  }
  const service = new ForumTopicCommandService(
    asDependency<CommandServiceConstructorArgs[0]>(drizzle),
    asDependency<CommandServiceConstructorArgs[1]>(forumPermissionService),
    asDependency<CommandServiceConstructorArgs[2]>(forumCounterService),
    asDependency<CommandServiceConstructorArgs[3]>(
      forumHashtagReferenceService,
    ),
    asDependency<CommandServiceConstructorArgs[4]>(mentionService),
    asDependency<CommandServiceConstructorArgs[5]>(bodyCompilerService),
    asDependency<CommandServiceConstructorArgs[6]>(bodyHtmlCodecService),
    asDependency<CommandServiceConstructorArgs[7]>({
      getMatchedWordsWithMetadataBySegments: jest.fn(() => ({
        highestLevel: undefined,
        hits: [],
        publicHits: [],
      })),
    }),
    asDependency<CommandServiceConstructorArgs[8]>(
      sensitiveWordReviewPolicyService,
    ),
    asDependency<CommandServiceConstructorArgs[9]>(forumHashtagBodyService),
    asDependency<CommandServiceConstructorArgs[10]>({}),
    asDependency<CommandServiceConstructorArgs[11]>({}),
    asDependency<CommandServiceConstructorArgs[12]>({
      dispatchDefinedEvent: jest.fn(),
    }),
    asDependency<CommandServiceConstructorArgs[13]>(appUserCountService),
    asDependency<CommandServiceConstructorArgs[14]>(actionLogService),
    asDependency<CommandServiceConstructorArgs[15]>({
      recordRecentUsageInTx: jest.fn(),
    }),
    asDependency<CommandServiceConstructorArgs[16]>({
      recordEntityHitsInTx: jest.fn(),
    }),
  )

  return {
    actionLogService,
    appUserCountService,
    bodyCompilerService,
    bodyHtmlCodecService,
    db,
    drizzle,
    forumCounterService,
    forumHashtagBodyService,
    forumHashtagReferenceService,
    forumPermissionService,
    mentionService,
    sensitiveWordReviewPolicyService,
    service,
  }
}

function createCommandTx(options?: {
  cascadeRows?: Array<{ topicDeleteCascadeId: string | null }>
  commentSummaries?: Array<{
    commentCount: number
    receivedLikeCount: number
    userId: number
  }>
  restoredComments?: Array<{
    auditStatus: number
    body: unknown
    id: number
    isHidden: boolean
    userId: number
  }>
  topicUpdateFirst?: boolean
  topicUpdateResult?: unknown
}) {
  const commentSummaryBuilder = createSelectBuilder(
    options?.commentSummaries ?? [],
  )
  const cascadeBuilder = createSelectBuilder(options?.cascadeRows ?? [])
  const restoredCommentBuilder = createSelectBuilder(
    options?.restoredComments ?? [],
  )
  const commentUpdateBuilder = createUpdateBuilder([{ id: 1 }])
  const topicUpdateBuilder = createUpdateBuilder(
    options && 'topicUpdateResult' in options ? options.topicUpdateResult : [],
  )
  const selectBuilders =
    options && 'cascadeRows' in options
      ? [cascadeBuilder, restoredCommentBuilder, commentSummaryBuilder]
      : [commentSummaryBuilder]
  const updateBuilders = options?.topicUpdateFirst
    ? [topicUpdateBuilder, commentUpdateBuilder]
    : [commentUpdateBuilder, topicUpdateBuilder]
  let selectIndex = 0
  let updateIndex = 0
  const tx: CommandTx & {
    cascadeBuilder: typeof cascadeBuilder
    commentSummaryBuilder: typeof commentSummaryBuilder
    commentUpdateBuilder: typeof commentUpdateBuilder
    restoredCommentBuilder: typeof restoredCommentBuilder
    topicUpdateBuilder: typeof topicUpdateBuilder
  } = {
    cascadeBuilder,
    commentSummaryBuilder,
    commentUpdateBuilder,
    execute: jest.fn(async () => undefined),
    query: {
      forumSection: { findFirst: jest.fn() },
      forumTopic: { findFirst: jest.fn() },
    },
    restoredCommentBuilder,
    select: jest.fn(() => selectBuilders[selectIndex++] ?? commentSummaryBuilder),
    topicUpdateBuilder,
    update: jest.fn(() => updateBuilders[updateIndex++] ?? topicUpdateBuilder),
  }

  return tx
}

async function expectBusinessCode(
  promise: Promise<unknown>,
  code: BusinessErrorCodeValue,
) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('ForumTopicCommandService business errors', () => {
  it('rejects empty html through the public create path', async () => {
    const { bodyHtmlCodecService, db, service } = createCommandService()
    const tx = createCommandTx()
    tx.query.forumSection.findFirst.mockResolvedValueOnce({
      deletedAt: null,
      group: null,
      groupId: null,
      id: 10,
      isEnabled: true,
      topicReviewPolicy: 1,
    })
    db.transaction.mockImplementationOnce(
      async (callback: (runner: CommandTx) => unknown) => callback(tx),
    )

    await expectBusinessCode(
      service.createForumTopic({
        html: '   ',
        sectionId: 10,
        userId: 100,
      }),
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    )
    expect(bodyHtmlCodecService.parseHtmlOrThrow).not.toHaveBeenCalled()
  })

  it('rejects update/delete when the current user is not the topic author', async () => {
    const topic = createTopic({ userId: 100 })
    const { service } = createCommandService({ activeTopic: topic })

    await expectBusinessCode(
      service.updateUserTopic(999, { html: '<p>x</p>', id: topic.id }),
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    )
    await expectBusinessCode(
      service.deleteUserTopic(999, topic.id),
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
    )
  })
})

describe('ForumTopicCommandService delete transaction side effects', () => {
  it('aggregates comment owners and syncs all deletion side effects in transaction', async () => {
    const tx = createCommandTx({
      commentSummaries: [
        { commentCount: 2, receivedLikeCount: 3, userId: 200 },
        { commentCount: 1, receivedLikeCount: 0, userId: 201 },
      ],
      topicUpdateResult: [{ id: 1 }],
    })
    const {
      actionLogService,
      appUserCountService,
      drizzle,
      forumCounterService,
      forumHashtagReferenceService,
      mentionService,
      service,
    } = createCommandService()
    const topic = createTopic({
      favoriteCount: 4,
      likeCount: 5,
      sectionId: 10,
      userId: 100,
    })

    await expect(
      service.deleteTopicWithCurrentInTx(tx as unknown as Db, topic, {}, 99),
    ).resolves.toBe(true)

    expect(tx.select).toHaveBeenCalledTimes(1)
    expect(tx.commentSummaryBuilder.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'user_comment.user_id' }),
    )
    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(tx.commentUpdateBuilder.state.set).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(Date),
        topicDeleteCascadeId: expect.stringMatching(/^topic-delete:1:/),
      }),
    )
    expect(drizzle.assertAffectedRows).toHaveBeenCalledWith(
      [{ id: 1 }],
      '主题不存在',
    )
    expect(mentionService.deleteMentionsInTx).toHaveBeenCalledWith({
      sourceIds: [topic.id],
      sourceType: expect.any(Number),
      tx,
    })
    expect(
      forumHashtagReferenceService.deleteReferencesInTx,
    ).toHaveBeenCalledWith({
      sourceIds: [topic.id],
      sourceType: expect.any(Number),
      tx,
    })
    expect(
      mentionService.deleteCommentMentionsByForumTopicInTx,
    ).toHaveBeenCalledWith(tx, topic.id)
    expect(
      forumHashtagReferenceService.deleteCommentReferencesByTopicInTx,
    ).toHaveBeenCalledWith(tx, topic.id)
    expect(forumCounterService.updateUserForumTopicCount).toHaveBeenCalledWith(
      tx,
      topic.userId,
      -1,
    )
    expect(
      forumCounterService.updateUserForumTopicReceivedLikeCount,
    ).toHaveBeenCalledWith(tx, topic.userId, -topic.likeCount)
    expect(
      forumCounterService.updateUserForumTopicReceivedFavoriteCount,
    ).toHaveBeenCalledWith(tx, topic.userId, -topic.favoriteCount)
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      200,
      -2,
    )
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      201,
      -1,
    )
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledWith(tx, 200, -3)
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledTimes(1)
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledWith(
      tx,
      topic.sectionId,
    )
    expect(actionLogService.createActionLogInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        targetId: topic.id,
        userId: 99,
      }),
    )
  })

  it('does not continue side effects when the topic soft delete affects no rows', async () => {
    const tx = createCommandTx({
      commentSummaries: [
        { commentCount: 1, receivedLikeCount: 1, userId: 200 },
      ],
      topicUpdateResult: [],
    })
    const {
      actionLogService,
      appUserCountService,
      forumCounterService,
      mentionService,
      service,
    } = createCommandService({
      assertAffectedRows: () => {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '主题不存在',
        )
      },
    })

    await expectBusinessCode(
      service.deleteTopicWithCurrentInTx(
        tx as unknown as Db,
        createTopic(),
        {},
        99,
      ),
      BusinessErrorCode.RESOURCE_NOT_FOUND,
    )

    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(mentionService.deleteMentionsInTx).not.toHaveBeenCalled()
    expect(forumCounterService.updateUserForumTopicCount).not.toHaveBeenCalled()
    expect(appUserCountService.updateCommentCount).not.toHaveBeenCalled()
    expect(actionLogService.createActionLogInTx).not.toHaveBeenCalled()
  })
})

describe('ForumTopicCommandService restore transaction side effects', () => {
  it('restores only cascade-deleted comments and rebuilds their references', async () => {
    const tx = createCommandTx({
      cascadeRows: [{ topicDeleteCascadeId: 'topic-delete:1:abc' }],
      commentSummaries: [
        { commentCount: 2, receivedLikeCount: 3, userId: 200 },
      ],
      restoredComments: [
        {
          auditStatus: 1,
          body: { type: 'doc', content: [] },
          id: 501,
          isHidden: false,
          userId: 200,
        },
        {
          auditStatus: 2,
          body: { type: 'doc', content: [] },
          id: 502,
          isHidden: true,
          userId: 201,
        },
      ],
      topicUpdateFirst: true,
      topicUpdateResult: [{ id: 1 }],
    })
    tx.query.forumSection.findFirst.mockResolvedValueOnce({
      deletedAt: null,
      group: null,
      groupId: null,
      isEnabled: true,
      topicReviewPolicy: 1,
    })
    const {
      appUserCountService,
      bodyCompilerService,
      drizzle,
      forumCounterService,
      forumHashtagBodyService,
      forumHashtagReferenceService,
      mentionService,
      service,
    } = createCommandService()
    const topic = createTopic({
      deletedAt: new Date('2026-06-01T02:00:00.000Z'),
      favoriteCount: 4,
      likeCount: 5,
      sectionId: 10,
      userId: 100,
    })

    await expect(
      service.restoreTopicWithCurrentInTx(
        tx as unknown as Db,
        topic,
        { id: topic.id, sectionId: 20 },
        {},
        99,
      ),
    ).resolves.toBe(true)

    expect(tx.select).toHaveBeenCalledTimes(3)
    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(tx.topicUpdateBuilder.state.set).toEqual({
      deletedAt: null,
      sectionId: 20,
    })
    expect(tx.commentUpdateBuilder.state.set).toEqual({
      deletedAt: null,
      topicDeleteCascadeId: null,
    })
    expect(drizzle.assertAffectedRows).toHaveBeenCalledWith(
      [{ id: 1 }],
      '已删除主题不存在',
    )
    expect(forumHashtagBodyService.materializeBodyInTx).toHaveBeenCalledTimes(3)
    expect(bodyCompilerService.compile).toHaveBeenCalledTimes(3)
    expect(mentionService.replaceMentionsInTx).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 501,
        sourceType: 1,
        tx,
      }),
    )
    expect(
      forumHashtagReferenceService.replaceReferencesInTx,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        isSourceVisible: true,
        sectionId: 20,
        sourceId: 501,
        sourceType: 2,
        topicId: topic.id,
        userId: 200,
      }),
    )
    expect(
      forumHashtagReferenceService.replaceReferencesInTx,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        isSourceVisible: false,
        sectionId: 20,
        sourceId: 502,
        sourceType: 2,
        topicId: topic.id,
        userId: 201,
      }),
    )
    expect(
      forumHashtagReferenceService.syncCommentVisibilityByTopicInTx,
    ).not.toHaveBeenCalled()
    expect(forumCounterService.updateUserForumTopicCount).toHaveBeenCalledWith(
      tx,
      topic.userId,
      1,
    )
    expect(appUserCountService.updateCommentCount).toHaveBeenCalledWith(
      tx,
      200,
      2,
    )
    expect(
      appUserCountService.updateCommentReceivedLikeCount,
    ).toHaveBeenCalledWith(tx, 200, 3)
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledWith(
      tx,
      10,
    )
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledWith(
      tx,
      20,
    )
    expect(mentionService.dispatchTopicMentionsInTx).toHaveBeenCalledWith(tx, {
      actorUserId: 99,
      topicId: topic.id,
      topicTitle: topic.title,
    })
  })
})

describe('ForumTopicCommandService move transaction locks', () => {
  it('locks source and target sections in stable order before moving', async () => {
    const tx = createCommandTx({ topicUpdateResult: [{ id: 1 }] })
    tx.query.forumSection.findFirst.mockResolvedValueOnce({
      deletedAt: null,
      group: null,
      groupId: null,
      isEnabled: true,
      topicReviewPolicy: 1,
    })
    const {
      drizzle,
      forumCounterService,
      forumHashtagReferenceService,
      service,
    } = createCommandService()

    await expect(
      service.moveTopicInTx(tx as unknown as Db, { id: 1, sectionId: 20 }, 10),
    ).resolves.toBe(true)

    expect(tx.execute).toHaveBeenCalledTimes(2)
    expect((tx.execute as jest.Mock).mock.calls[0]?.[0]).toMatchObject({
      values: expect.arrayContaining([10]),
    })
    expect((tx.execute as jest.Mock).mock.calls[1]?.[0]).toMatchObject({
      values: expect.arrayContaining([20]),
    })
    expect(tx.query.forumSection.findFirst).toHaveBeenCalledTimes(1)
    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(drizzle.assertAffectedRows).toHaveBeenCalledWith(
      [{ id: 1 }],
      '主题不存在',
    )
    expect(
      forumHashtagReferenceService.syncSectionIdsByTopicInTx,
    ).toHaveBeenCalledWith(tx, 1, 20)
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledWith(
      tx,
      10,
    )
    expect(forumCounterService.syncSectionVisibleState).toHaveBeenCalledWith(
      tx,
      20,
    )
  })
})
