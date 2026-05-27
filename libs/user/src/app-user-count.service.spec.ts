/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AppUserCountDeltaFailureCauseCode } from './app-user-count.constant'
import { AppUserCountService } from './app-user-count.service'

// 创建本 spec 需要的最小 app_user_count schema。
function createSchema() {
  return {
    appUserCount: {
      commentCount: 'app_user_count.comment_count',
      userId: 'app_user_count.user_id',
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

// 构造只服务计数更新分支的用户计数服务。
function createService() {
  const drizzle = {
    schema: createSchema(),
  }
  return new AppUserCountService(drizzle as unknown as DrizzleService)
}

// 断言用户计数更新失败保留稳定业务错误与 cause.code。
async function expectUserCountFailure(
  promise: Promise<unknown>,
  causeCode: string,
) {
  await expect(promise).rejects.toEqual(
    expect.objectContaining({
      cause: { code: causeCode },
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '用户计数不存在或计数不足',
    }),
  )
}

describe('AppUserCountService counter updates', () => {
  it('keeps target-not-found cause when the user count row is missing', async () => {
    const tx = createCounterTx([], [])
    const service = createService()

    await expectUserCountFailure(
      service.updateCommentCount(tx as never, 1, 1),
      AppUserCountDeltaFailureCauseCode.TARGET_NOT_FOUND,
    )

    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(tx.select).toHaveBeenCalledTimes(1)
  })

  it('keeps insufficient-count cause when a negative update would underflow', async () => {
    const tx = createCounterTx([], [{ userId: 1 }])
    const service = createService()

    await expectUserCountFailure(
      service.updateCommentCount(tx as never, 1, -1),
      AppUserCountDeltaFailureCauseCode.INSUFFICIENT_COUNT,
    )
  })

  it('does not probe existence when the counter update succeeds', async () => {
    const tx = createCounterTx([{ userId: 1 }], [])
    const service = createService()

    await expect(service.updateCommentCount(tx as never, 1, -1)).resolves.toBe(
      undefined,
    )

    expect(tx.select).not.toHaveBeenCalled()
  })

  it('throws BusinessException on counter failure', async () => {
    const tx = createCounterTx([], [])
    const service = createService()

    await expect(service.updateCommentCount(tx as never, 1, 1)).rejects.toBeInstanceOf(
      BusinessException,
    )
  })
})
