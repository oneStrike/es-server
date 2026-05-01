import { SystemConfigService } from './system-config.service'

describe('SystemConfigService', () => {
  it('persists operation config without the legacy top-level forum hashtag config', async () => {
    const latestConfig = {
      id: 11,
      aliyunConfig: {},
      siteConfig: {},
      maintenanceConfig: {},
      contentReviewPolicy: {},
      uploadConfig: {},
    }
    const insertValues = jest.fn((snapshot: Record<string, unknown>) => ({
      returning: jest.fn().mockResolvedValue([
        {
          ...latestConfig,
          ...snapshot,
          operationConfig: {
            forumHashtagConfig: {
              creationMode: 1,
            },
          },
        },
      ]),
    }))
    const tx = {
      execute: jest.fn(),
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue([latestConfig]),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        values: insertValues,
      })),
    }
    const drizzle = {
      db: {},
      schema: {
        systemConfig: {
          id: 'id',
        },
      },
      withTransaction: jest.fn(async (callback) => callback(tx)),
      withErrorHandling: jest.fn(async (callback) => callback()),
    }
    const cacheManager = {
      set: jest.fn(),
    }
    const configReader = {
      refresh: jest.fn(),
      get: jest.fn(),
    }
    const service = new SystemConfigService(
      { encrypt: jest.fn(), decrypt: jest.fn() } as never,
      { decryptWith: jest.fn() } as never,
      cacheManager as never,
      configReader as never,
      drizzle as never,
    )

    await service.updateConfig(
      {
        id: 11,
        operationConfig: {
          forumHashtagConfig: {
            creationMode: 1,
          },
        },
      } as never,
      7,
    )

    const persistedSnapshot = insertValues.mock.calls[0]?.[0]
    expect(persistedSnapshot).toMatchObject({
      operationConfig: {
        forumHashtagConfig: {
          creationMode: 1,
        },
      },
      updatedById: 7,
    })
    expect(persistedSnapshot).not.toHaveProperty('forumHashtagConfig')
  })
})
