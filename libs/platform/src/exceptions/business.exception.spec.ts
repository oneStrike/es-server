import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from './business.exception'

describe('BusinessException', () => {
  it.each([
    [{ detail: 'driver error' }],
    ['string cause'],
    [1],
    [null],
    [new Error('boom')],
  ])('preserves arbitrary unknown cause values: %p', (cause) => {
    const exception = new BusinessException(
      BusinessErrorCode.STATE_CONFLICT,
      '状态冲突',
      { cause },
    )

    expect(exception.cause).toBe(cause)
    expect(exception.code).toBe(BusinessErrorCode.STATE_CONFLICT)
    expect(exception.message).toBe('状态冲突')
    expect(exception.name).toBe('BusinessException')
    expect(exception).toBeInstanceOf(BusinessException)
    expect(exception).toBeInstanceOf(Error)
  })
})
