import type { UploadService } from '@libs/platform/modules/upload/upload.service'
import type { ConfigReader } from '@libs/system-config/config-reader'
import type { ConfigService } from '@nestjs/config'
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http'
import type { LookupFunction } from 'node:net'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { HttpException } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { PassThrough } from 'node:stream'
import { RemoteImageImportService } from './remote-image-import.service'

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class UploadService {},
}))

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}))

jest.mock('node:https', () => ({
  ...jest.requireActual('node:https'),
  request: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'remote-image-id'),
}))

describe('RemoteImageImportService', () => {
  const mockedHttpsRequest = jest.mocked(httpsRequest) as unknown as jest.Mock
  const mockedLookup = jest.mocked(lookup)
  const uploadTmpDir = 'D:\\code\\es\\es-server\\uploads\\tmp'
  const tempDir = `${uploadTmpDir}\\third-party-comic-test`

  function mockLookupAddresses(
    addresses: Array<{ address: string; family: 4 | 6 }>,
  ) {
    mockedLookup.mockResolvedValueOnce(addresses as never)
  }

  // 模拟原生 https 响应流，锁定下载行为而不依赖真实网络。
  function mockImageDownload({
    body = Buffer.from([1, 2, 3]),
    headers = { 'content-type': 'image/jpeg' },
    inspect,
    statusCode = 200,
    statusMessage = 'OK',
  }: {
    body?: Buffer
    headers?: Record<string, string>
    inspect?: (url: URL, options: RequestOptions) => void
    statusCode?: number
    statusMessage?: string
  } = {}) {
    mockedHttpsRequest.mockImplementationOnce(
      (
        url: URL,
        options: RequestOptions,
        callback: (response: IncomingMessage) => void,
      ) => {
        inspect?.(url, options)
        const clientRequest = new EventEmitter() as EventEmitter &
          Pick<ClientRequest, 'destroy' | 'end' | 'setTimeout'>
        clientRequest.destroy = jest.fn((error?: Error) => {
          if (error) {
            clientRequest.emit('error', error)
          }
          return clientRequest as ClientRequest
        }) as never
        clientRequest.end = jest.fn(() => {
          const response = new PassThrough() as unknown as IncomingMessage &
            PassThrough
          Object.assign(response, {
            headers,
            statusCode,
            statusMessage,
          })
          callback(response)
          response.end(body)
        }) as never
        clientRequest.setTimeout = jest.fn(() => clientRequest) as never
        return clientRequest
      },
    )
  }

  // 模拟原生请求层失败，验证下载错误按业务异常收口。
  function mockImageRequestError(error: Error) {
    mockedHttpsRequest.mockImplementationOnce(() => {
      const clientRequest = new EventEmitter() as EventEmitter &
        Pick<ClientRequest, 'destroy' | 'end' | 'setTimeout'>
      clientRequest.destroy = jest.fn((destroyError?: Error) => {
        if (destroyError) {
          clientRequest.emit('error', destroyError)
        }
        return clientRequest as ClientRequest
      }) as never
      clientRequest.end = jest.fn(() => {
        clientRequest.emit('error', error)
      }) as never
      clientRequest.setTimeout = jest.fn(() => clientRequest) as never
      return clientRequest
    })
  }

  function createService(enableAddressGuard = true) {
    const uploadedFile = {
      deleteTarget: {
        filePath: '/uploads/comic/remote.jpg',
        provider: 'local',
      },
      upload: {
        filePath: '/uploads/comic/remote.jpg',
        fileSize: 3,
        mimeType: 'image/jpeg',
      },
    }
    const uploadService = {
      deleteUploadedFile: jest.fn(async () => undefined),
      uploadLocalFileWithDeleteTarget: jest.fn(async () => uploadedFile),
    }
    const configReader = {
      getRemoteImageImportSecurityConfig: jest.fn(() => ({
        enableAddressGuard,
      })),
    }
    const configService = {
      get: jest.fn((key: string) =>
        key === 'upload'
          ? {
              tmpDir: uploadTmpDir,
            }
          : undefined,
      ),
    }

    return {
      service: new RemoteImageImportService(
        uploadService as unknown as UploadService,
        configReader as unknown as ConfigReader,
        configService as unknown as ConfigService,
      ),
      configService,
      uploadedFile,
      uploadService,
      configReader,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockedHttpsRequest.mockReset()
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    jest.spyOn(fs, 'mkdtemp').mockResolvedValue(tempDir)
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined)
    jest.spyOn(fs, 'rm').mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses the validated DNS answer for the outbound image request by default', async () => {
    const { service, uploadService, configReader, configService } =
      createService()
    let lookupFromRequest: LookupFunction | undefined
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageDownload({
      inspect: (_url, options) => {
        lookupFromRequest = options.lookup as LookupFunction
      },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', [
        'comic',
        'image',
      ]),
    ).resolves.toMatchObject({
      upload: {
        filePath: '/uploads/comic/remote.jpg',
      },
    })

    expect(lookupFromRequest).toBeDefined()
    await expect(
      new Promise((resolve, reject) => {
        lookupFromRequest?.(
          'sw.mangafunb.fun',
          {},
          (error, address, family) => {
            if (error) {
              reject(error)
              return
            }
            resolve({ address, family })
          },
        )
      }),
    ).resolves.toEqual({ address: '93.184.216.34', family: 4 })
    expect(mockedLookup).toHaveBeenCalledTimes(1)
    expect(uploadService.uploadLocalFileWithDeleteTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        localPath: expect.stringContaining('third-party-comic-test'),
        objectKeySegments: ['comic', 'image'],
        originalName: '001.jpg',
      }),
    )
    const uploadArg = (
      uploadService.uploadLocalFileWithDeleteTarget.mock
        .calls as unknown as Array<[Record<string, unknown>]>
    )[0][0]
    expect(uploadArg).not.toHaveProperty('provider')
    expect(uploadArg).not.toHaveProperty('resolveProvider')
    expect(configService.get).toHaveBeenCalledWith('upload')
    expect(configReader.getRemoteImageImportSecurityConfig).toHaveBeenCalled()
    expect(fs.mkdir).toHaveBeenCalledWith(uploadTmpDir, { recursive: true })
    const request = mockedHttpsRequest.mock.results[0]?.value as Pick<
      ClientRequest,
      'setTimeout'
    >
    expect(request.setTimeout).toHaveBeenCalledWith(
      300000,
      expect.any(Function),
    )
    expect(fs.mkdtemp).toHaveBeenCalledWith(
      expect.stringContaining(uploadTmpDir),
    )
    expect(fs.mkdtemp).toHaveBeenCalledWith(
      expect.stringContaining('third-party-comic-'),
    )
    expect(fs.rm).toHaveBeenCalledWith(tempDir, {
      force: true,
      recursive: true,
    })
  })

  it('skips DNS address guard when system security config disables it', async () => {
    const { service, configReader } = createService(false)
    let lookupFromRequest: unknown
    mockImageDownload({
      inspect: (_url, options) => {
        lookupFromRequest = options.lookup
      },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).resolves.toMatchObject({
      upload: {
        filePath: '/uploads/comic/remote.jpg',
      },
    })

    expect(lookupFromRequest).toBeUndefined()
    expect(mockedLookup).not.toHaveBeenCalled()
    expect(configReader.getRemoteImageImportSecurityConfig).toHaveBeenCalled()
  })

  it('passes image context to the success callback in import order', async () => {
    const { service, uploadedFile } = createService()
    jest
      .spyOn(service, 'importImage')
      .mockResolvedValueOnce(uploadedFile as never)
      .mockResolvedValueOnce(uploadedFile as never)
    const onImported = jest.fn(async () => undefined)

    await expect(
      service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/comic/001.jpg?token=secret',
          },
          {
            providerImageId: 'image-002',
            sortOrder: 2,
            url: 'https://sw.mangafunb.fun/comic/002.jpg#secret',
          },
        ],
        ['comic'],
        onImported,
      ),
    ).resolves.toEqual([
      '/uploads/comic/remote.jpg',
      '/uploads/comic/remote.jpg',
    ])

    expect(onImported).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        filePath: '/uploads/comic/remote.jpg',
        imageIndex: 1,
        imageTotal: 2,
        mimeType: 'image/jpeg',
        safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
      }),
    )
    expect(onImported).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        imageIndex: 2,
        imageTotal: 2,
        safeSourceUrl: 'https://sw.mangafunb.fun/comic/002.jpg',
      }),
    )
  })

  it('keeps BusinessException semantics when adding image failure context', async () => {
    const { service } = createService()
    jest
      .spyOn(service, 'importImage')
      .mockRejectedValueOnce(
        new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '远程资源不是图片',
        ) as never,
      )

    await expect(
      service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/comic/001.jpg?token=secret',
          },
        ],
        ['comic'],
      ),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '远程资源不是图片',
      cause: expect.objectContaining({
        imageIndex: 1,
        imageTotal: 1,
        originalCode: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
        stage: 'remote-image-import',
      }),
    })
  })

  it('does not leak credential-bearing original causes into image failure context', async () => {
    const { service } = createService()
    jest.spyOn(service, 'importImage').mockRejectedValueOnce(
      new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '远程资源不是图片',
        {
          cause: {
            signedUrl:
              'https://sw.mangafunb.fun/comic/001.jpg?token=secret-token',
            token: 'secret-token',
          },
        },
      ) as never,
    )

    let thrownError: unknown
    try {
      await service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/comic/001.jpg?token=secret-token',
          },
        ],
        ['comic'],
      )
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toMatchObject({
      cause: expect.objectContaining({
        safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
      }),
    })
    expect((thrownError as { cause?: unknown }).cause).not.toHaveProperty(
      'originalCause',
    )
    expect(
      JSON.stringify((thrownError as { cause?: unknown }).cause),
    ).not.toContain('secret-token')
  })

  it('removes credentials from safe source URLs in image failure context', async () => {
    const { service } = createService()
    jest
      .spyOn(service, 'importImage')
      .mockRejectedValueOnce(new Error('remote upload failed') as never)

    let thrownError: unknown
    try {
      await service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://user:secret-password@sw.mangafunb.fun/comic/001.jpg?token=secret-token#secret-fragment',
          },
        ],
        ['comic'],
      )
    } catch (error) {
      thrownError = error
    }

    const cause = (thrownError as { cause?: unknown }).cause
    expect(cause).toMatchObject({
      safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
    })
    const serializedCause = JSON.stringify(cause)
    expect(serializedCause).not.toContain('secret-password')
    expect(serializedCause).not.toContain('secret-token')
    expect(serializedCause).not.toContain('secret-fragment')
  })

  it('redacts credential-bearing original error messages in image failure context', async () => {
    const { service } = createService()
    jest
      .spyOn(service, 'importImage')
      .mockRejectedValueOnce(
        new Error('token = secret-token upload failed') as never,
      )

    let thrownError: unknown
    try {
      await service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/comic/001.jpg',
          },
        ],
        ['comic'],
      )
    } catch (error) {
      thrownError = error
    }

    const cause = (thrownError as { cause?: unknown }).cause
    expect(cause).toMatchObject({
      originalMessage: '[REDACTED] upload failed',
    })
    expect(JSON.stringify(cause)).not.toContain('secret-token')
  })

  it('keeps HttpException status when adding image failure context', async () => {
    const { service } = createService()
    jest
      .spyOn(service, 'importImage')
      .mockRejectedValueOnce(new HttpException('upload failed', 504) as never)

    await expect(
      service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/comic/001.jpg',
          },
        ],
        ['comic'],
      ),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        originalCode: 504,
        safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
      }),
      status: 504,
    })
  })

  it('preserves sanitized provider diagnostics when Superbed upload fails', async () => {
    const { service } = createService()
    jest.spyOn(service, 'importImage').mockRejectedValueOnce(
      new HttpException('Superbed 上传失败', 500, {
        cause: {
          provider: 'superbed',
          operation: 'upload',
          transportCode: 'ETIMEDOUT',
          httpStatus: 504,
          responseData: {
            err: 1,
            msg: 'quota exceeded',
            token: 'secret-token',
          },
          config: {
            headers: {
              Authorization: 'Bearer secret-token',
            },
          },
        },
      }) as never,
    )

    let thrownError: unknown
    try {
      await service.importImages(
        [
          {
            providerImageId: 'image-001',
            sortOrder: 1,
            url: 'https://sw.mangafunb.fun/comic/001.jpg',
          },
        ],
        ['comic'],
      )
    } catch (error) {
      thrownError = error
    }

    const cause = (thrownError as { cause?: unknown }).cause
    expect(cause).toMatchObject({
      originalCause: {
        httpStatus: 504,
        operation: 'upload',
        provider: 'superbed',
        responseData: {
          err: 1,
          msg: 'quota exceeded',
        },
        transportCode: 'ETIMEDOUT',
      },
      originalCode: 500,
      originalMessage: 'Superbed 上传失败',
      providerImageId: 'image-001',
      safeSourceUrl: 'https://sw.mangafunb.fun/comic/001.jpg',
      stage: 'remote-image-import',
    })
    const serializedCause = JSON.stringify(cause)
    expect(serializedCause).not.toContain('secret-token')
    expect(serializedCause).not.toMatch(
      /authorization|cookie|headers|body|form|config|request|password|secret|token/i,
    )
  })

  it('rejects non-HTTPS URLs before DNS lookup or download', async () => {
    const { service } = createService()

    await expect(
      service.importImage('http://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片必须使用 HTTPS')

    expect(mockedLookup).not.toHaveBeenCalled()
    expect(mockedHttpsRequest).not.toHaveBeenCalled()
  })

  it('rejects non-allowlisted hosts before DNS lookup or download', async () => {
    const { service } = createService()

    await expect(
      service.importImage('https://example.com/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片域名不在允许范围内')

    expect(mockedLookup).not.toHaveBeenCalled()
    expect(mockedHttpsRequest).not.toHaveBeenCalled()
  })

  it('rejects empty DNS answers before download', async () => {
    const { service } = createService()
    mockLookupAddresses([])

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片解析到不安全地址')

    expect(mockedHttpsRequest).not.toHaveBeenCalled()
  })

  it.each([
    '0.0.0.1',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '224.0.0.1',
    '240.0.0.1',
  ])('rejects unsafe IPv4 DNS answer %s', async (address) => {
    const { service } = createService()
    mockLookupAddresses([{ address, family: 4 }])

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片解析到不安全地址')

    expect(mockedHttpsRequest).not.toHaveBeenCalled()
  })

  it.each(['::', '::1', 'fe80::1', 'fc00::1', 'fd00::1', 'ff00::1'])(
    'rejects unsafe IPv6 DNS answer %s',
    async (address) => {
      const { service } = createService()
      mockLookupAddresses([{ address, family: 6 }])

      await expect(
        service.importImage('https://sw.mangafunb.fun/comic/001.jpg', [
          'comic',
        ]),
      ).rejects.toThrow('远程图片解析到不安全地址')

      expect(mockedHttpsRequest).not.toHaveBeenCalled()
    },
  )

  it('rejects unsafe IPv4-mapped IPv6 DNS answers', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '::ffff:127.0.0.1', family: 6 }])

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片解析到不安全地址')

    expect(mockedHttpsRequest).not.toHaveBeenCalled()
  })

  it('rejects HTTP redirects instead of following them', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageDownload({
      headers: { location: 'https://sw.mangafunb.fun/other.jpg' },
      statusCode: 302,
      statusMessage: 'Found',
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片下载失败')
  })

  it('wraps native request errors as remote image business failures', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageRequestError(new Error('socket hang up'))

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '远程图片下载失败',
      cause: {
        transportError: {
          message: 'socket hang up',
          name: 'Error',
        },
      },
    })
  })

  it('rejects non-image content types', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageDownload({
      body: Buffer.from('not image'),
      headers: { 'content-type': 'text/html' },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程资源不是图片')
  })

  it('rejects oversized image payloads', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageDownload({
      body: Buffer.alloc(10 * 1024 * 1024 + 1),
      headers: { 'content-type': 'image/jpeg' },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片大小超过限制')
  })

  it('removes the temporary directory when upload fails', async () => {
    const { service, uploadService } = createService()
    uploadService.uploadLocalFileWithDeleteTarget.mockRejectedValueOnce(
      new Error('upload failed'),
    )
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageDownload()

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('upload failed')

    expect(fs.rm).toHaveBeenCalledWith(tempDir, {
      force: true,
      recursive: true,
    })
  })

  it('removes the temporary directory when writing the downloaded file fails', async () => {
    const { service, uploadService } = createService()
    jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('write failed'))
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockImageDownload()

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('write failed')

    expect(uploadService.uploadLocalFileWithDeleteTarget).not.toHaveBeenCalled()
    expect(fs.rm).toHaveBeenCalledWith(tempDir, {
      force: true,
      recursive: true,
    })
  })
})
