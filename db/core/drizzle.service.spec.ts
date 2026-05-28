import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { DrizzleService } from './drizzle.service'
import { PostgresErrorCode } from './error/postgres-error'

describe('DrizzleService', () => {
  let service: DrizzleService
  let pool: { end: jest.Mock }

  beforeEach(() => {
    pool = { end: jest.fn() }
    service = new DrizzleService(
      { transaction: jest.fn((fn) => fn({ tx: true })) } as never,
      pool as never,
      {
        get: jest.fn(() => ({
          pageIndex: 1,
          pageSize: 20,
          maxListItemLimit: 100,
        })),
      } as never,
    )
  })

  it('accepts unknown errors for predicates, extraction, and handling', () => {
    const source = {
      code: PostgresErrorCode.UNIQUE_VIOLATION,
      constraint: 'app_user_phone_key',
    }

    expect(service.isUniqueViolation(source)).toBe(true)
    expect(service.extractError(source)).toMatchObject({
      code: PostgresErrorCode.UNIQUE_VIOLATION,
      constraint: 'app_user_phone_key',
    })
    expect(() => service.handleError(source, { duplicate: '已存在' })).toThrow(
      BusinessException,
    )
  })

  it('asserts affected rows for arrays and rowCount results', () => {
    expect(() => service.assertAffectedRows([])).toThrow(BusinessException)
    expect(() => service.assertAffectedRows({ rowCount: 0 })).toThrow(
      BusinessException,
    )
    expect(() => service.assertAffectedRows([{ id: 1 }])).not.toThrow()
    expect(() => service.assertAffectedRows({ rowCount: 1 })).not.toThrow()
  })

  it('maps empty results to not-found when withErrorHandling receives notFound message', async () => {
    await expect(
      service.withErrorHandling(() => Promise.resolve([]), {
        notFound: '用户不存在',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '用户不存在',
    })
  })

  it('maps PostgreSQL errors through core handler and preserves cause', async () => {
    const source = { code: PostgresErrorCode.UNIQUE_VIOLATION }

    await expect(
      service.withErrorHandling(() => Promise.reject(source), {
        duplicate: '已存在',
      }),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
      message: '已存在',
      cause: source,
    })
  })

  it('runs transactions through the injected db and closes the pool on shutdown', async () => {
    await expect(
      service.withTransaction(async () => ({ tx: true as const })),
    ).resolves.toEqual({ tx: true })

    await service.onApplicationShutdown()
    expect(pool.end).toHaveBeenCalledTimes(1)
  })
})
