import * as schema from '@db/schema'
import { PgDialect } from 'drizzle-orm/pg-core'
import { DEFAULT_APP_CONFIG } from './config.constant'
import { AppConfigService } from './config.service'

describe('appConfigService', () => {
  const dialect = new PgDialect()

  let service: AppConfigService
  let drizzle: any
  let dbSelectLimitMock: jest.Mock
  let txSelectLimitMock: jest.Mock
  let txExecuteMock: jest.Mock
  let txInsertValuesMock: jest.Mock
  let txInsertReturningMock: jest.Mock
  let updateSetMock: jest.Mock
  let updateWhereMock: jest.Mock

  beforeEach(() => {
    dbSelectLimitMock = jest.fn()
    txSelectLimitMock = jest.fn()
    txExecuteMock = jest.fn().mockResolvedValue(undefined)
    txInsertReturningMock = jest.fn()
    txInsertValuesMock = jest.fn(() => ({
      returning: txInsertReturningMock,
    }))
    updateWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    updateSetMock = jest.fn(() => ({
      where: updateWhereMock,
    }))

    const tx = {
      execute: txExecuteMock,
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: txSelectLimitMock,
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: txInsertValuesMock,
      })),
    }

    drizzle = {
      db: {
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: dbSelectLimitMock,
            })),
          })),
        })),
        update: jest.fn(() => ({
          set: updateSetMock,
        })),
      },
      schema,
      withTransaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn(tx)),
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }

    service = new AppConfigService(drizzle)
  })

  it('空表读取时会在事务内加咨询锁后初始化默认配置', async () => {
    const createdConfig = {
      id: 1,
      ...DEFAULT_APP_CONFIG,
    }

    dbSelectLimitMock.mockResolvedValueOnce([])
    txSelectLimitMock.mockResolvedValueOnce([])
    txInsertReturningMock.mockResolvedValueOnce([createdConfig])

    const result = await service.findActiveConfig()

    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(txExecuteMock).toHaveBeenCalledTimes(1)

    const rendered = dialect.sqlToQuery(txExecuteMock.mock.calls[0][0]).sql
    expect(rendered).toContain('pg_advisory_xact_lock')
    expect(txInsertValuesMock).toHaveBeenCalledWith(DEFAULT_APP_CONFIG)
    expect(result).toEqual(createdConfig)
  })

  it('更新配置时会把当前用户写入 updatedById', async () => {
    dbSelectLimitMock.mockResolvedValueOnce([{ id: 7 }])

    await service.updateConfig(
      {
        appName: '新的应用名称',
      } as any,
      99,
    )

    expect(updateSetMock).toHaveBeenCalledWith({
      appName: '新的应用名称',
      updatedById: 99,
    })
  })

  it('更新配置时会对 0 行变更收口 notFound 语义', async () => {
    dbSelectLimitMock.mockResolvedValueOnce([{ id: 7 }])

    await service.updateConfig(
      {
        appName: '新的应用名称',
      } as any,
      99,
    )

    expect(drizzle.withErrorHandling).toHaveBeenCalledWith(
      expect.any(Function),
      {
        notFound: '应用配置不存在',
      },
    )
  })
})
