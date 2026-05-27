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
      topicCount: 'forum_section.topic_count',
    },
    forumTopic: {
      deletedAt: 'forum_topic.deleted_at',
      id: 'forum_topic.id',
      likeCount: 'forum_topic.like_count',
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

// 构造只服务计数更新分支的论坛计数服务。
function createService() {
  const drizzle = {
    schema: createSchema(),
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
