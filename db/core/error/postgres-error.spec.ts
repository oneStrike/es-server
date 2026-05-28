import { BusinessErrorCode, PlatformErrorCode } from '@libs/platform/constant'
import {
  getPostgresError,
  getPostgresErrorResponseDescriptor,
  PostgresErrorCode,
} from './postgres-error'

describe('postgres-error', () => {
  it('returns null for empty and primitive inputs', () => {
    expect(getPostgresError(null)).toBeNull()
    expect(getPostgresError(undefined)).toBeNull()
    expect(getPostgresError('boom')).toBeNull()
    expect(getPostgresError(1)).toBeNull()
  })

  it('normalizes a direct PostgreSQL driver-shaped error', () => {
    const error = {
      code: PostgresErrorCode.UNIQUE_VIOLATION,
      constraint: 'user_email_key',
      table: 'app_user',
      column: 'email',
      detail: 'Key already exists',
      message: 'duplicate key value violates unique constraint',
    }

    expect(getPostgresError(error)).toEqual({
      code: PostgresErrorCode.UNIQUE_VIOLATION,
      constraint: 'user_email_key',
      table: 'app_user',
      column: 'email',
      detail: 'Key already exists',
      message: 'duplicate key value violates unique constraint',
    })
  })

  it('normalizes a cause-wrapped PostgreSQL error', () => {
    const error = new Error('outer message', {
      cause: {
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column: 'name',
        message: 'null value violates not-null constraint',
      },
    })

    expect(getPostgresError(error)).toEqual({
      code: PostgresErrorCode.NOT_NULL_VIOLATION,
      column: 'name',
      message: 'null value violates not-null constraint',
    })
  })

  it('falls back to cause message, outer message, then default database message', () => {
    expect(
      getPostgresError({
        message: 'outer message',
        cause: { code: '99999' },
      })?.message,
    ).toBe('outer message')

    expect(getPostgresError({ code: '99999' })?.message).toBe('数据库操作失败')
  })

  it('returns null when no string code exists', () => {
    expect(getPostgresError({ code: 23505 })).toBeNull()
    expect(getPostgresError({ cause: { code: 23505 } })).toBeNull()
  })

  it('returns shared response descriptors for known PostgreSQL codes', () => {
    expect(
      getPostgresErrorResponseDescriptor(PostgresErrorCode.UNIQUE_VIOLATION),
    ).toEqual({
      status: 200,
      responseCode: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      message: '数据已存在',
      exceptionKind: 'business',
      messageKey: 'duplicate',
    })
    expect(
      getPostgresErrorResponseDescriptor(
        PostgresErrorCode.SERIALIZATION_FAILURE,
      ),
    ).toEqual({
      status: 200,
      responseCode: BusinessErrorCode.STATE_CONFLICT,
      message: '操作冲突，请重试',
      exceptionKind: 'business',
      messageKey: 'conflict',
    })
    expect(
      getPostgresErrorResponseDescriptor(PostgresErrorCode.NOT_NULL_VIOLATION),
    ).toMatchObject({
      status: 400,
      responseCode: PlatformErrorCode.BAD_REQUEST,
      message: '必填字段不能为空',
    })
    expect(
      getPostgresErrorResponseDescriptor(PostgresErrorCode.CHECK_VIOLATION),
    ).toMatchObject({
      status: 400,
      responseCode: PlatformErrorCode.BAD_REQUEST,
      message: '数据不符合要求',
    })
  })

  it('returns null descriptors for unknown PostgreSQL codes', () => {
    expect(getPostgresErrorResponseDescriptor('99999')).toBeNull()
  })
})
