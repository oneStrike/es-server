import * as schema from '@db/schema'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BadRequestException } from '@nestjs/common'
import { PgDialect } from 'drizzle-orm/pg-core'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.types'
import { DEFAULT_CONFIG } from './system-config.constant'
import { SystemConfigService } from './system-config.service'

describe('systemConfigService', () => {
  const dialect = new PgDialect()

  let service: SystemConfigService
  let drizzle: any
  let txExecuteMock: jest.Mock
  let txSelectLimitMock: jest.Mock
  let txInsertValuesMock: jest.Mock
  let txInsertReturningMock: jest.Mock
  let cacheManager: { set: jest.Mock }
  let configReader: { get: jest.Mock, refresh: jest.Mock }
  let aesService: { encrypt: jest.Mock, decrypt: jest.Mock }
  let rsaService: { decryptWith: jest.Mock }

  function createSelectChain(limitMock: jest.Mock) {
    return {
      from: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: limitMock,
        })),
      })),
    }
  }

  function createLatestSnapshot(overrides: Record<string, unknown> = {}) {
    return {
      id: 5,
      updatedById: 1,
      aliyunConfig: {
        accessKeyId: 'cipher-ak-id',
        accessKeySecret: 'cipher-ak-secret',
        sms: {
          endpoint: 'dypnsapi.aliyuncs.com',
          signName: '旧签名',
          verifyCodeLength: 6,
          verifyCodeExpire: 300,
        },
      },
      siteConfig: {
        siteName: '数据库最新站点',
        siteDescription: '数据库最新描述',
        siteKeywords: '漫画,社区',
        siteLogo: '',
        siteFavicon: '',
        contactEmail: '',
        icpNumber: '',
      },
      maintenanceConfig: {
        enableMaintenanceMode: false,
        maintenanceMessage: '旧维护提示',
      },
      contentReviewPolicy: DEFAULT_CONFIG.contentReviewPolicy,
      uploadConfig: DEFAULT_CONFIG.uploadConfig,
      createdAt: new Date('2026-04-15T01:00:00.000Z'),
      updatedAt: new Date('2026-04-15T01:00:00.000Z'),
      ...overrides,
    }
  }

  beforeEach(() => {
    txExecuteMock = jest.fn().mockResolvedValue(undefined)
    txSelectLimitMock = jest.fn()
    txInsertReturningMock = jest.fn()
    txInsertValuesMock = jest.fn(() => ({
      returning: txInsertReturningMock,
    }))

    const tx = {
      execute: txExecuteMock,
      select: jest.fn(() => createSelectChain(txSelectLimitMock)),
      insert: jest.fn(() => ({
        values: txInsertValuesMock,
      })),
    }

    drizzle = {
      schema,
      db: {
        select: jest.fn(() => createSelectChain(jest.fn())),
      },
      withTransaction: jest.fn(async (fn: (trx: any) => Promise<unknown>) => fn(tx)),
      withErrorHandling: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    }

    cacheManager = {
      set: jest.fn().mockResolvedValue(undefined),
    }
    configReader = {
      get: jest.fn().mockReturnValue({
        ...DEFAULT_CONFIG,
        siteConfig: {
          ...DEFAULT_CONFIG.siteConfig,
          siteName: '缓存旧站点',
        },
      }),
      refresh: jest.fn().mockResolvedValue(undefined),
    }
    aesService = {
      encrypt: jest.fn(async (value: string) => `enc:${value}`),
      decrypt: jest.fn(async (value: string) => value.replace(/^enc:/, '')),
    }
    rsaService = {
      decryptWith: jest.fn((value: string) => {
        throw new Error(`not rsa payload: ${value}`)
      }),
    }

    service = new SystemConfigService(
      aesService as never,
      rsaService as never,
      cacheManager as never,
      configReader as never,
      drizzle as never,
    )
  })

  it('使用过期快照 id 更新时返回状态冲突错误', async () => {
    txSelectLimitMock.mockResolvedValueOnce([createLatestSnapshot({ id: 8 })])

    await expect(
      service.updateConfig(
        {
          id: 7,
          siteConfig: {
            siteName: '新站点',
          },
        },
        99,
      ),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.STATE_CONFLICT,
      message: '系统配置已更新，请刷新后重试',
    })

    expect(txInsertValuesMock).not.toHaveBeenCalled()

    const rendered = dialect.sqlToQuery(txExecuteMock.mock.calls[0][0]).sql
    expect(rendered).toContain('pg_advisory_xact_lock')
  })

  it('更新时以数据库最新快照为基底而不是缓存快照', async () => {
    const latestSnapshot = createLatestSnapshot()
    const insertedSnapshot = createLatestSnapshot({
      id: 6,
      updatedById: 99,
      maintenanceConfig: {
        enableMaintenanceMode: true,
        maintenanceMessage: '旧维护提示',
      },
    })
    txSelectLimitMock.mockResolvedValueOnce([latestSnapshot])
    txInsertReturningMock.mockResolvedValueOnce([insertedSnapshot])

    await service.updateConfig(
      {
        id: 5,
        maintenanceConfig: {
          enableMaintenanceMode: true,
        },
      },
      99,
    )

    expect(txInsertValuesMock).toHaveBeenCalledWith({
      aliyunConfig: latestSnapshot.aliyunConfig,
      siteConfig: latestSnapshot.siteConfig,
      maintenanceConfig: {
        enableMaintenanceMode: true,
        maintenanceMessage: '旧维护提示',
      },
      contentReviewPolicy: latestSnapshot.contentReviewPolicy,
      uploadConfig: latestSnapshot.uploadConfig,
      updatedById: 99,
    })
    expect(txInsertValuesMock.mock.calls[0][0].siteConfig.siteName).toBe(
      '数据库最新站点',
    )
  })

  it('敏感字段传回掩码时保留数据库中的旧密文', async () => {
    const latestSnapshot = createLatestSnapshot({
      uploadConfig: {
        provider: UploadProviderEnum.QINIU,
        superbedNonImageFallbackToLocal: true,
        qiniu: {
          accessKey: 'cipher-access-key',
          secretKey: 'cipher-secret-key',
          bucket: 'es-public',
          domain: 'https://cdn.example.com',
          region: 'z0',
          pathPrefix: 'uploads',
          useHttps: true,
          tokenExpires: 3600,
        },
        superbed: DEFAULT_CONFIG.uploadConfig.superbed,
      },
    })
    txSelectLimitMock.mockResolvedValueOnce([latestSnapshot])
    txInsertReturningMock.mockResolvedValueOnce([
      createLatestSnapshot({
        id: 6,
        uploadConfig: latestSnapshot.uploadConfig,
      }),
    ])

    await service.updateConfig(
      {
        id: 5,
        uploadConfig: {
          provider: UploadProviderEnum.QINIU,
          qiniu: {
            accessKey: 'abc******xyz',
            secretKey: 'def******uvw',
          },
        },
      },
      99,
    )

    expect(txInsertValuesMock.mock.calls[0][0].uploadConfig.qiniu.accessKey).toBe(
      'cipher-access-key',
    )
    expect(txInsertValuesMock.mock.calls[0][0].uploadConfig.qiniu.secretKey).toBe(
      'cipher-secret-key',
    )
  })

  it('切换到七牛但缺少必要配置时拒绝保存', async () => {
    txSelectLimitMock.mockResolvedValueOnce([createLatestSnapshot()])

    await expect(
      service.updateConfig(
        {
          id: 5,
          uploadConfig: {
            provider: UploadProviderEnum.QINIU,
            qiniu: {
              accessKey: 'ak',
              secretKey: 'sk',
              bucket: 'bucket',
            },
          },
        },
        99,
      ),
    ).rejects.toThrow(new BadRequestException('七牛上传配置不完整：缺少 domain'))

    expect(txInsertValuesMock).not.toHaveBeenCalled()
  })

  it('切换到 Superbed 但缺少 token 时拒绝保存', async () => {
    txSelectLimitMock.mockResolvedValueOnce([createLatestSnapshot()])

    await expect(
      service.updateConfig(
        {
          id: 5,
          uploadConfig: {
            provider: UploadProviderEnum.SUPERBED,
            superbed: {
              categories: 'cover,chapter',
            },
          },
        },
        99,
      ),
    ).rejects.toThrow(
      new BadRequestException('Superbed 上传配置不完整：缺少 token'),
    )

    expect(txInsertValuesMock).not.toHaveBeenCalled()
  })
})
