import { CountDeltaFailureCauseCode } from '@db/extensions'
import { BusinessErrorCode, ContentTypeEnum } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { WorkCounterService } from './work-counter.service'

type WorkCounterServicePrivateApi = {
  rethrowNotFound: (error: unknown, message: string) => never
  getWorkLikeTargetType: (workType: number) => number
}

describe('WorkCounterService count delta error handling', () => {
  function createService() {
    return new WorkCounterService({} as never)
  }

  it('keeps insufficient-count failures based on structured cause code', () => {
    const service = createService()
    const original = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '目标不存在',
      {
        cause: {
          code: CountDeltaFailureCauseCode.INSUFFICIENT_COUNT,
        },
      },
    )

    try {
      ;(service as unknown as WorkCounterServicePrivateApi).rethrowNotFound(
        original,
        '作品不存在',
      )
      fail('expected error to be thrown')
    } catch (error) {
      expect(error).toBe(original)
    }
  })

  it('translates target-not-found failures with the caller message', () => {
    const service = createService()
    const original = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '目标不存在或计数不足',
      {
        cause: {
          code: CountDeltaFailureCauseCode.TARGET_NOT_FOUND,
        },
      },
    )

    try {
      ;(service as unknown as WorkCounterServicePrivateApi).rethrowNotFound(
        original,
        '作品不存在',
      )
      fail('expected error to be thrown')
    } catch (error) {
      expect(error).toMatchObject({
        code: BusinessErrorCode.RESOURCE_NOT_FOUND,
        message: '作品不存在',
      })
    }
  })

  it('rejects unsupported work types with a business exception', () => {
    const service = createService()

    expect(() =>
      (
        service as unknown as WorkCounterServicePrivateApi
      ).getWorkLikeTargetType(ContentTypeEnum.TOPIC),
    ).toThrow(
      new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的作品类型',
      ),
    )
  })
})
