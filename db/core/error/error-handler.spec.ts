import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import {
  executeWithErrorHandling,
  extractError,
  handleError,
  isCheckViolation,
  isNotNullViolation,
  isSerializationFailure,
  isUniqueViolation,
} from './error-handler'
import { PostgresErrorCode } from './postgres-error'

describe('error-handler', () => {
  it('accepts unknown PostgreSQL inputs for predicates and extraction', () => {
    const direct = { code: PostgresErrorCode.UNIQUE_VIOLATION }
    const wrapped = new Error('wrapped', {
      cause: { code: PostgresErrorCode.NOT_NULL_VIOLATION, column: 'name' },
    })
    const serialization = {
      cause: { code: PostgresErrorCode.SERIALIZATION_FAILURE },
    }

    expect(isUniqueViolation(direct)).toBe(true)
    expect(isNotNullViolation(wrapped)).toBe(true)
    expect(isCheckViolation({ code: PostgresErrorCode.CHECK_VIOLATION })).toBe(
      true,
    )
    expect(isSerializationFailure(serialization)).toBe(true)
    expect(extractError(wrapped)).toMatchObject({
      code: PostgresErrorCode.NOT_NULL_VIOLATION,
      column: 'name',
    })
  })

  it('passes through existing business, http, and ordinary errors', () => {
    const business = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      'missing',
    )
    expect(() => handleError(business)).toThrow(business)

    const badRequest = new BadRequestException('bad')
    expect(() => handleError(badRequest)).toThrow(badRequest)

    const ordinary = new Error('boom')
    expect(() => handleError(ordinary)).toThrow(ordinary)
  })

  it('wraps non-error unknown values as internal database failures', () => {
    try {
      handleError('boom')
      throw new Error('unreachable')
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException)
      expect((error as Error).message).toBe('数据库操作失败')
      expect((error as Error).cause).toBe('boom')
    }
  })

  it('maps unique violations to business exceptions with custom message and cause', () => {
    const source = { code: PostgresErrorCode.UNIQUE_VIOLATION }

    try {
      handleError(source, { duplicate: '邮箱已被使用' })
      throw new Error('unreachable')
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException)
      expect((error as BusinessException).code).toBe(
        BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      )
      expect((error as Error).message).toBe('邮箱已被使用')
      expect((error as Error).cause).toBe(source)
    }
  })

  it('maps serialization failures to state conflict business exceptions', () => {
    const source = { code: PostgresErrorCode.SERIALIZATION_FAILURE }

    try {
      handleError(source, { conflict: '请重试' })
      throw new Error('unreachable')
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException)
      expect((error as BusinessException).code).toBe(
        BusinessErrorCode.STATE_CONFLICT,
      )
      expect((error as Error).message).toBe('请重试')
      expect((error as Error).cause).toBe(source)
    }
  })

  it('maps not-null and check violations to bad requests with cause', () => {
    const notNull = { code: PostgresErrorCode.NOT_NULL_VIOLATION }
    const check = { code: PostgresErrorCode.CHECK_VIOLATION }

    expectBadRequestWithCause(notNull, { notNull: '必填' }, '必填')
    expectBadRequestWithCause(check, { check: '范围非法' }, '范围非法')
  })

  it('maps unknown PostgreSQL codes to internal database failures with cause', () => {
    const source = { code: '99999' }

    try {
      handleError(source)
      throw new Error('unreachable')
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException)
      expect((error as Error).message).toBe('数据库操作失败')
      expect((error as Error).cause).toBe(source)
    }
  })

  it('returns successful values and converts rejected PostgreSQL errors', async () => {
    await expect(
      executeWithErrorHandling(() => Promise.resolve(1)),
    ).resolves.toBe(1)

    const source = { code: PostgresErrorCode.UNIQUE_VIOLATION }
    await expect(
      executeWithErrorHandling(() => Promise.reject(source), {
        duplicate: '已存在',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      cause: source,
    })

    const ordinary = new Error('boom')
    await expect(
      executeWithErrorHandling(() => Promise.reject(ordinary)),
    ).rejects.toBe(ordinary)
  })
})

function expectBadRequestWithCause(
  source: unknown,
  messages: Parameters<typeof handleError>[1],
  expectedMessage: string,
) {
  try {
    handleError(source, messages)
    throw new Error('unreachable')
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException)
    expect((error as Error).message).toBe(expectedMessage)
    expect((error as Error).cause).toBe(source)
  }
}
