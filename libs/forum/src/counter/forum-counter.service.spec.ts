import { CountDeltaFailureCauseCode } from '@db/extensions'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ForumCounterService } from './forum-counter.service'

type ForumCounterServicePrivateApi = {
  rethrowCountDeltaNotFound: (error: unknown, message: string) => never
}

describe('ForumCounterService count delta error handling', () => {
  function createService() {
    return new ForumCounterService({} as never, {} as never)
  }

  it('translates target-not-found failures with the caller message', () => {
    const service = createService()
    const original = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '目标不存在',
      {
        cause: {
          code: CountDeltaFailureCauseCode.TARGET_NOT_FOUND,
        },
      },
    )

    try {
      ;(
        service as unknown as ForumCounterServicePrivateApi
      ).rethrowCountDeltaNotFound(original, '主题不存在')
      fail('expected error to be thrown')
    } catch (error) {
      expect(error).toMatchObject({
        code: BusinessErrorCode.RESOURCE_NOT_FOUND,
        message: '主题不存在',
      })
    }
  })

  it('keeps insufficient-count failures untouched', () => {
    const service = createService()
    const original = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '目标不存在或计数不足',
      {
        cause: {
          code: CountDeltaFailureCauseCode.INSUFFICIENT_COUNT,
        },
      },
    )

    try {
      ;(
        service as unknown as ForumCounterServicePrivateApi
      ).rethrowCountDeltaNotFound(original, '主题不存在')
      fail('expected error to be thrown')
    } catch (error) {
      expect(error).toBe(original)
    }
  })
})
