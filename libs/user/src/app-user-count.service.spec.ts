import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AppUserCountService } from './app-user-count.service'

describe('AppUserCountService error semantics', () => {
  it('translates missing count rows into stable business exception while preserving the original cause', async () => {
    const originalError = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '原始读模型不存在',
    )
    const drizzle = {
      withErrorHandling: jest.fn().mockRejectedValue(originalError),
    }

    const service = new AppUserCountService(drizzle as never)

    await expect(service.updateCommentCount(undefined, 7, 1)).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '用户计数不存在或计数不足',
    })

    try {
      await service.updateCommentCount(undefined, 7, 1)
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException)
      expect((error as BusinessException).cause).toBe(originalError)
    }
  })

  it('treats unsupported follow target types as business failures instead of protocol exceptions', async () => {
    const service = new AppUserCountService({} as never)

    await expect(
      service.updateFollowingCountByTargetType(undefined, 7, 999 as never, 1),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '不支持的关注类型: 999',
    })
  })
})
