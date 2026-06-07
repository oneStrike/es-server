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
  state: {
    from?: unknown
    groupBy?: unknown[]
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
    }),
    userComment: createTable('user_comment', {
      deletedAt: createColumn('user_comment.deleted_at'),
      id: createColumn('user_comment.id'),
      likeCount: createColumn('user_comment.like_count'),
      targetId: createColumn('user_comment.target_id'),
      targetType: createColumn('user_comment.target_type'),
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
  }
  const forumHashtagReferenceService = {
    deleteCommentReferencesByTopicInTx: jest.fn(async () => undefined),
    deleteReferencesInTx: jest.fn(async () => undefined),
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
  const service = new ForumTopicCommandService(
    asDependency<CommandServiceConstructorArgs[0]>(drizzle),
    asDependency<CommandServiceConstructorArgs[1]>(forumPermissionService),
    asDependency<CommandServiceConstructorArgs[2]>(forumCounterService),
    asDependency<CommandServiceConstructorArgs[3]>(
      forumHashtagReferenceService,
    ),
    asDependency<CommandServiceConstructorArgs[4]>(mentionService),
    asDependency<CommandServiceConstructorArgs[5]>({ compile: jest.fn() }),
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
    asDependency<CommandServiceConstructorArgs[9]>({
      materializeBodyInTx: jest.fn(),
    }),
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
    bodyHtmlCodecService,
    db,
    drizzle,
    forumCounterService,
    forumHashtagReferenceService,
    forumPermissionService,
    mentionService,
    sensitiveWordReviewPolicyService,
    service,
  }
}

function createCommandTx(options?: {
  commentSummaries?: Array<{
    commentCount: number
    receivedLikeCount: number
    userId: number
  }>
  topicUpdateResult?: unknown
}) {
  const commentSummaryBuilder = createSelectBuilder(
    options?.commentSummaries ?? [],
  )
  const commentUpdateBuilder = createUpdateBuilder([{ id: 1 }])
  const topicUpdateBuilder = createUpdateBuilder(
    options && 'topicUpdateResult' in options ? options.topicUpdateResult : [],
  )
  const tx: CommandTx & {
    commentSummaryBuilder: typeof commentSummaryBuilder
    commentUpdateBuilder: typeof commentUpdateBuilder
    topicUpdateBuilder: typeof topicUpdateBuilder
  } = {
    commentSummaryBuilder,
    commentUpdateBuilder,
    query: {
      forumSection: { findFirst: jest.fn() },
      forumTopic: { findFirst: jest.fn() },
    },
    select: jest.fn(() => commentSummaryBuilder),
    topicUpdateBuilder,
    update: jest
      .fn()
      .mockReturnValueOnce(commentUpdateBuilder)
      .mockReturnValueOnce(topicUpdateBuilder),
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
