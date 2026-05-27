/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { WorkCountDeltaFailureCauseCode } from './work-counter.constant'
import { WorkCounterService } from './work-counter.service'

// 创建本 spec 需要的最小 work/work_chapter schema。
function createSchema() {
  return {
    work: {
      deletedAt: 'work.deleted_at',
      id: 'work.id',
      isPublished: 'work.is_published',
      likeCount: 'work.like_count',
      type: 'work.type',
    },
    workChapter: {
      deletedAt: 'work_chapter.deleted_at',
      id: 'work_chapter.id',
      likeCount: 'work_chapter.like_count',
      workType: 'work_chapter.work_type',
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

// 构造只服务计数更新分支的作品计数服务。
function createService() {
  const drizzle = {
    schema: createSchema(),
  }
  return new WorkCounterService(drizzle as unknown as DrizzleService)
}

// 断言作品计数更新失败保留稳定业务错误与 cause.code。
async function expectWorkCountFailure(
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

describe('WorkCounterService counter updates', () => {
  it('keeps target-not-found cause when the work row is missing', async () => {
    const tx = createCounterTx([], [])
    const service = createService()

    await expectWorkCountFailure(
      service.updateWorkLikeCount(tx as never, 1, 1, 1),
      '作品不存在',
      WorkCountDeltaFailureCauseCode.TARGET_NOT_FOUND,
    )

    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(tx.select).toHaveBeenCalledTimes(1)
  })

  it('keeps insufficient-count cause when a work decrement would underflow', async () => {
    const tx = createCounterTx([], [{ id: 1 }])
    const service = createService()

    await expectWorkCountFailure(
      service.updateWorkLikeCount(tx as never, 1, 1, -1),
      '目标不存在或计数不足',
      WorkCountDeltaFailureCauseCode.INSUFFICIENT_COUNT,
    )
  })

  it('does not probe existence when the work counter update succeeds', async () => {
    const tx = createCounterTx([{ id: 1 }], [])
    const service = createService()

    await expect(
      service.updateWorkLikeCount(tx as never, 1, 1, -1),
    ).resolves.toBe(undefined)

    expect(tx.select).not.toHaveBeenCalled()
  })

  it('keeps target-not-found cause when the chapter row is missing', async () => {
    const tx = createCounterTx([], [])
    const service = createService()

    await expectWorkCountFailure(
      service.updateWorkChapterLikeCount(tx as never, 1, 1, 1),
      '章节不存在',
      WorkCountDeltaFailureCauseCode.TARGET_NOT_FOUND,
    )
  })
})
