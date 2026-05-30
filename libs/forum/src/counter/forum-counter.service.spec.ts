/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { ForumCountDeltaFailureCauseCode } from './forum-counter.constant'
import { ForumCounterService } from './forum-counter.service'

// 创建本 spec 需要的最小 forum_section/forum_topic schema。
function createSchema() {
  return {
    forumSection: {
      deletedAt: 'forum_section.deleted_at',
      id: 'forum_section.id',
      commentCount: 'forum_section.comment_count',
      lastPostAt: 'forum_section.last_post_at',
      lastTopicId: 'forum_section.last_topic_id',
      topicCount: 'forum_section.topic_count',
    },
    forumTopic: {
      auditStatus: 'forum_topic.audit_status',
      commentCount: 'forum_topic.comment_count',
      createdAt: 'forum_topic.created_at',
      deletedAt: 'forum_topic.deleted_at',
      id: 'forum_topic.id',
      isHidden: 'forum_topic.is_hidden',
      lastCommentAt: 'forum_topic.last_comment_at',
      lastCommentUserId: 'forum_topic.last_comment_user_id',
      likeCount: 'forum_topic.like_count',
      sectionId: 'forum_topic.section_id',
    },
    userComment: {
      auditStatus: 'user_comment.audit_status',
      createdAt: 'user_comment.created_at',
      deletedAt: 'user_comment.deleted_at',
      id: 'user_comment.id',
      isHidden: 'user_comment.is_hidden',
      targetId: 'user_comment.target_id',
      targetType: 'user_comment.target_type',
      userId: 'user_comment.user_id',
    },
  }
}

// 创建只覆盖 update + existence select 链路的事务 mock。
function createCounterTx(updateRows: unknown[], existingRows: unknown[]) {
  const returning = jest.fn(async () => updateRows)
  const updateWhere = jest.fn(() => ({ returning }))
  const set = jest.fn(() => ({ where: updateWhere }))
  const update = jest.fn(() => ({ set }))
  const limit = jest.fn(async () => existingRows)
  const selectWhere = jest.fn(() => ({ limit }))
  const from = jest.fn(() => ({ where: selectWhere }))
  const select = jest.fn(() => ({ from }))

  return {
    from,
    limit,
    returning,
    select,
    selectWhere,
    set,
    update,
    updateWhere,
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
    limit: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
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

function createUpdateQuery(result: unknown = [{ id: 1 }]) {
  const chain = {
    set: jest.fn(() => chain),
    where: jest.fn(() => ({
      returning: jest.fn(async () => result),
    })),
  }

  return chain
}

// 构造只服务计数更新分支的论坛计数服务。
function createService(db?: Record<string, unknown>) {
  const drizzle = {
    db,
    schema: createSchema(),
    assertAffectedRows: jest.fn(),
    withErrorHandling: jest.fn((fn) => fn()),
  }
  return new ForumCounterService(
    drizzle as unknown as DrizzleService,
    {} as never,
  )
}

// 断言论坛计数更新失败保留稳定业务错误与 cause.code。
async function expectForumCountFailure(
  promise: Promise<unknown>,
  message: string,
  causeCode: string,
) {
  await expect(promise).rejects.toEqual(
    expect.objectContaining({
      cause: { code: causeCode },
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message,
    }),
  )
}

describe('ForumCounterService counter updates', () => {
  it('keeps target-not-found cause when the section row is missing', async () => {
    const tx = createCounterTx([], [])
    const service = createService()

    await expectForumCountFailure(
      service.updateSectionTopicCount(tx as never, 1, 1),
      '板块不存在',
      ForumCountDeltaFailureCauseCode.TARGET_NOT_FOUND,
    )

    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(tx.select).toHaveBeenCalledTimes(1)
  })

  it('keeps insufficient-count cause when a section decrement would underflow', async () => {
    const tx = createCounterTx([], [{ id: 1 }])
    const service = createService()

    await expectForumCountFailure(
      service.updateSectionTopicCount(tx as never, 1, -1),
      '目标不存在或计数不足',
      ForumCountDeltaFailureCauseCode.INSUFFICIENT_COUNT,
    )
  })

  it('does not probe existence when the section counter update succeeds', async () => {
    const tx = createCounterTx([{ id: 1 }], [])
    const service = createService()

    await expect(
      service.updateSectionTopicCount(tx as never, 1, -1),
    ).resolves.toBe(undefined)

    expect(tx.select).not.toHaveBeenCalled()
  })

  it('keeps target-not-found cause when the topic row is missing', async () => {
    const tx = createCounterTx([], [])
    const service = createService()

    await expectForumCountFailure(
      service.updateTopicLikeCount(tx as never, 1, 1),
      '主题不存在',
      ForumCountDeltaFailureCauseCode.TARGET_NOT_FOUND,
    )
  })
})

describe('ForumCounterService rebuild query shape', () => {
  it('syncTopicCommentState 使用可见评论条件并按 createdAt/id 倒序取最后评论', async () => {
    const summaryQuery = createChainQuery([{ commentCount: 2 }])
    const latestQuery = createChainQuery([
      { userId: 100, createdAt: new Date('2026-05-30T00:00:00.000Z') },
    ])
    const updateQuery = createUpdateQuery()
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(summaryQuery)
        .mockReturnValueOnce(latestQuery),
      update: jest.fn(() => updateQuery),
    }
    const service = createService(db)

    await service.syncTopicCommentState(undefined, 1)

    expect(summaryQuery.where).toHaveBeenCalledTimes(1)
    expect(latestQuery.where).toHaveBeenCalledTimes(1)
    expect(latestQuery.orderBy).toHaveBeenCalledTimes(1)
    expect(latestQuery.limit).toHaveBeenCalledWith(1)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  it('syncSectionVisibleState 使用可见主题条件并按活动时间/id 倒序取最后主题', async () => {
    const summaryQuery = createChainQuery([{ topicCount: 2, commentCount: 5 }])
    const latestQuery = createChainQuery([
      { id: 9, lastPostAt: new Date('2026-05-30T00:00:00.000Z') },
    ])
    const updateQuery = createUpdateQuery()
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(summaryQuery)
        .mockReturnValueOnce(latestQuery),
      update: jest.fn(() => updateQuery),
    }
    const service = createService(db)

    await service.syncSectionVisibleState(undefined, 10)

    expect(summaryQuery.where).toHaveBeenCalledTimes(1)
    expect(latestQuery.where).toHaveBeenCalledTimes(1)
    expect(latestQuery.orderBy).toHaveBeenCalledTimes(1)
    expect(latestQuery.limit).toHaveBeenCalledWith(1)
    expect(db.update).toHaveBeenCalledTimes(1)
  })
})
