import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { sql } from 'drizzle-orm'
import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core'
import { DrizzleService } from './drizzle.service'
import { PostgresErrorCode } from './error/postgres-error'

const pageParamTestTable = pgTable('page_param_test', {
  id: integer('id'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  score: integer('score'),
})

describe('DrizzleService', () => {
  let service: DrizzleService

  beforeEach(() => {
    service = new DrizzleService(
      { transaction: jest.fn((fn) => fn({ tx: true })) } as never,
      {
        get: jest.fn(() => ({
          pageIndex: 1,
          pageSize: 15,
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

  it('runs transactions through the injected db', async () => {
    await expect(
      service.withTransaction(async () => ({ tx: true as const })),
    ).resolves.toEqual({ tx: true })
  })

  it('normalizes complete PageDto params with configured defaults', () => {
    const result = service.buildPageParams(
      {
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      },
      {
        table: pageParamTestTable,
        fallbackOrderBy: [{ createdAt: 'desc' }],
      },
    )

    expect(result.page).toMatchObject({
      pageIndex: 1,
      pageSize: 15,
      limit: 15,
      offset: 0,
    })
    expect(result.order.orderBy).toEqual({
      createdAt: 'desc',
      id: 'desc',
    })
    expect(result.dateRange?.gte?.toISOString()).toBe(
      '2026-05-31T16:00:00.000Z',
    )
    expect(result.dateRange?.lt?.toISOString()).toBe('2026-06-02T16:00:00.000Z')
    expect(result).not.toHaveProperty('where')
  })

  it('normalizes numeric strings once and respects service max page size', () => {
    const result = service.buildPageParams(
      {
        pageIndex: '3',
        pageSize: '500',
      },
      {
        table: pageParamTestTable,
        maxPageSize: 50,
      },
    )

    expect(result.page).toMatchObject({
      pageIndex: 3,
      pageSize: 50,
      limit: 50,
      offset: 100,
    })
  })

  it('rejects invalid table-backed orderBy fields and directions', () => {
    expect(() =>
      service.buildPageParams(
        {
          orderBy: '{"missing":"desc"}',
        },
        {
          table: pageParamTestTable,
        },
      ),
    ).toThrow('排序字段 "missing" 不存在')

    expect(() =>
      service.buildPageParams(
        {
          orderBy: '{"createdAt":"sideways"}',
        },
        {
          table: pageParamTestTable,
        },
      ),
    ).toThrow('排序字段 "createdAt" 的排序方向无效')
  })

  it('rejects malformed orderBy JSON before query construction', () => {
    expect(() =>
      service.buildPageParams(
        {
          orderBy: "{createdAt:'desc'}",
        },
        {
          table: pageParamTestTable,
        },
      ),
    ).toThrow('orderBy 参数格式不合法')
  })

  it('builds allowlisted raw SQL ordering without accepting unchecked fields', () => {
    const result = service.buildPageParams(
      {
        orderBy: '{"score":"asc"}',
      },
      {
        allowlistedOrderBy: {
          columns: {
            id: sql.raw('"id"'),
            score: sql.raw('"score"'),
          },
          fallbackOrderBy: [{ score: 'desc' }],
        },
      },
    )

    expect(result.order.orderBy).toEqual({
      score: 'asc',
      id: 'asc',
    })
    expect(result.order.orderByClause).toBeDefined()
    expect(() =>
      service.buildPageParams(
        {
          orderBy: '{"createdAt":"desc"}',
        },
        {
          allowlistedOrderBy: {
            columns: {
              id: sql.raw('"id"'),
              score: sql.raw('"score"'),
            },
          },
        },
      ),
    ).toThrow('排序字段 "createdAt" 不存在')
  })
})
