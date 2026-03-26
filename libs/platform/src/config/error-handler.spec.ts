import { HttpException } from '@nestjs/common'
import { executeWithErrorHandling, handleError } from '../../../../db/core/error/error-handler'
import { PostgresErrorCode } from '../../../../db/core/error/postgres-error'

function createPostgresError(code: string) {
  return {
    code,
    message: 'postgres failure',
  }
}

describe('handleError', () => {
  it('preserves an existing HttpException instead of remapping it', () => {
    const pgError = createPostgresError(PostgresErrorCode.UNIQUE_VIOLATION)
    const mappedError = new HttpException('已点赞', 409, {
      cause: pgError,
    })

    try {
      handleError(mappedError, {
        duplicate: '外层消息',
      })
    } catch (error) {
      expect(error).toBe(mappedError)
      return
    }

    throw new Error('expected handleError to throw')
  })
})

describe('executeWithErrorHandling', () => {
  it('keeps the inner mapped message when nested wrappers are used', async () => {
    const result = executeWithErrorHandling(
      async () =>
        executeWithErrorHandling(
          async () => {
            throw createPostgresError(PostgresErrorCode.UNIQUE_VIOLATION)
          },
          {
            duplicate: '已点赞',
          },
        ),
      {
        duplicate: '外层消息',
      },
    )

    await expect(result).rejects.toMatchObject({
      message: '已点赞',
    })
    await expect(result).rejects.toBeInstanceOf(HttpException)
  })
})
