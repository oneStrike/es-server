import type { PreparedUploadFile, UploadSystemConfig } from './upload.type'
import { openAsBlob } from 'node:fs'
import { SuperbedUploadProvider } from './superbed-upload.provider'

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  openAsBlob: jest.fn(),
}))

describe('SuperbedUploadProvider', () => {
  const mockedOpenAsBlob = jest.mocked(openAsBlob)
  const fetchMock = jest.fn()

  function createFile(): PreparedUploadFile {
    return {
      tempPath: 'D:\\code\\es\\es-server\\uploads\\tmp\\.remote.uploading',
      objectKey: 'comic/image/001.jpg',
      finalName: '001.jpg',
      originalName: '001.jpg',
      mimeType: 'image/jpeg',
      ext: 'jpg',
      fileCategory: 'image',
      scene: 'comic',
      fileSize: 3,
    }
  }

  function createSystemConfig(): UploadSystemConfig {
    return {
      provider: 'superbed' as never,
      superbedNonImageFallbackToLocal: true,
      qiniu: {
        accessKey: '',
        secretKey: '',
        bucket: '',
        domain: '',
        region: '',
        pathPrefix: '',
        useHttps: true,
        tokenExpires: 3600,
      },
      superbed: {
        token: 'token',
        categories: 'comic',
      },
    }
  }

  // 构造 fetch JSON 响应，测试只关心业务可见数据与状态。
  function createJsonResponse(
    data: unknown,
    init: { status?: number; statusText?: string } = {},
  ): Response {
    const status = init.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: init.statusText ?? 'OK',
      json: jest.fn(async () => data),
      text: jest.fn(async () => JSON.stringify(data)),
    } as unknown as Response
  }

  // 构造非 JSON 响应，验证 HTTP 失败优先保留状态诊断。
  function createTextResponse(
    text: string,
    init: { status?: number; statusText?: string } = {},
  ): Response {
    const status = init.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: init.statusText ?? 'OK',
      json: jest.fn(async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      }),
      text: jest.fn(async () => text),
    } as unknown as Response
  }

  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = fetchMock as never
    mockedOpenAsBlob.mockResolvedValue(
      new Blob([Buffer.from([1, 2, 3])], { type: 'image/jpeg' }),
    )
  })

  it('returns a delete target that can be replayed during rollback', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        err: 0,
        url: 'https://pic.superbed.cn/item/001.jpg',
      }),
    )

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).resolves.toEqual({
      filePath: 'https://pic.superbed.cn/item/001.jpg',
      deleteTarget: {
        provider: 'superbed',
        filePath: 'https://pic.superbed.cn/item/001.jpg',
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.superbed.cn/upload',
      expect.objectContaining({
        body: expect.any(FormData),
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )
    const body = fetchMock.mock.calls[0][1].body as FormData
    expect(body.get('token')).toBe('token')
    expect(body.get('categories')).toBe('comic')
    expect(body.get('file')).toBeInstanceOf(File)
    expect((body.get('file') as File).name).toBe('001.jpg')
    expect(mockedOpenAsBlob).toHaveBeenCalledWith(
      createFile().tempPath,
      expect.objectContaining({ type: 'image/jpeg' }),
    )
  })

  it('preserves sanitized Superbed upload response diagnostics on provider failure', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        err: 1,
        msg: 'api quota exceeded',
        token: 'secret-token',
      }),
    )

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).rejects.toMatchObject({
      message: 'api quota exceeded',
      cause: {
        elapsedMs: expect.any(Number),
        fileCategory: 'image',
        fileSize: 3,
        finalName: '001.jpg',
        mimeType: 'image/jpeg',
        provider: 'superbed',
        operation: 'upload',
        originalName: '001.jpg',
        responseData: {
          err: 1,
          msg: 'api quota exceeded',
        },
        scene: 'comic',
        timeoutMs: 300000,
      },
    })
  })

  it('preserves sanitized transport diagnostics when Superbed upload request fails', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(
        {
          err: 1,
          msg: 'timeout',
          token: 'secret-token',
        },
        {
          status: 504,
          statusText: 'Gateway Timeout',
        },
      ),
    )

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).rejects.toMatchObject({
      message: 'Superbed 上传失败',
      cause: {
        elapsedMs: expect.any(Number),
        provider: 'superbed',
        operation: 'upload',
        transportCode: 'HTTP_504',
        fileCategory: 'image',
        fileSize: 3,
        finalName: '001.jpg',
        httpStatus: 504,
        mimeType: 'image/jpeg',
        originalName: '001.jpg',
        statusText: 'Gateway Timeout',
        responseData: {
          err: 1,
          msg: 'timeout',
        },
        scene: 'comic',
        timeoutMs: 300000,
      },
    })
  })

  it('preserves HTTP diagnostics when Superbed upload failure is not JSON', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockResolvedValueOnce(
      createTextResponse('<html>server error</html>', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    )

    let thrownError: unknown
    try {
      await provider.upload(createFile(), createSystemConfig())
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toMatchObject({
      message: 'Superbed 上传失败',
      cause: {
        provider: 'superbed',
        operation: 'upload',
        transportCode: 'HTTP_500',
        httpStatus: 500,
        statusText: 'Internal Server Error',
      },
    })
    expect(
      (thrownError as { cause?: Record<string, unknown> }).cause,
    ).not.toHaveProperty('responseData')
  })

  it('preserves sanitized Superbed delete response diagnostics on provider failure', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        err: 1,
        msg: 'delete denied',
        token: 'secret-token',
      }),
    )

    await expect(
      provider.delete(
        {
          provider: 'superbed' as never,
          filePath: 'https://pic.superbed.cn/item/001.jpg',
        },
        createSystemConfig(),
      ),
    ).rejects.toMatchObject({
      message: 'delete denied',
      cause: {
        provider: 'superbed',
        operation: 'delete',
        responseData: {
          err: 1,
          msg: 'delete denied',
        },
      },
    })
  })

  it('does not expose sensitive Superbed diagnostics in thrown causes', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error('Bearer secret-token timeout'), {
        code: 'ETIMEDOUT',
        config: {
          headers: { Authorization: 'Bearer secret-token' },
          token: 'secret-token',
        },
      }),
    )

    let thrownError: unknown
    try {
      await provider.upload(createFile(), createSystemConfig())
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toBeDefined()
    const serializedCause = JSON.stringify(
      (thrownError as { cause?: unknown }).cause,
    )
    expect(serializedCause).not.toContain('secret-token')
    expect(serializedCause).not.toMatch(
      /authorization|cookie|headers|body|form|config|request|password|secret|token/i,
    )
  })

  it('redacts configured Superbed token from failure messages and cause values', async () => {
    const provider = new SuperbedUploadProvider()
    const systemConfig = createSystemConfig()
    systemConfig.superbed.token = 'secret-token'
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        err: 1,
        msg: 'token = secret-token quota exceeded',
        message: '"token": "secret-token"',
        error: 'Bearer secret-token',
      }),
    )

    let thrownError: unknown
    try {
      await provider.upload(createFile(), systemConfig)
    } catch (error) {
      thrownError = error
    }
    expect(thrownError).toMatchObject({
      message: '[REDACTED] quota exceeded',
      cause: {
        responseData: {
          msg: '[REDACTED] quota exceeded',
          message: '"[REDACTED]"',
          error: 'Bearer [REDACTED]',
        },
      },
    })
    expect(JSON.stringify(thrownError)).not.toContain('secret-token')
  })

  it('redacts credential-bearing upload file names from failure diagnostics', async () => {
    const provider = new SuperbedUploadProvider()
    const systemConfig = createSystemConfig()
    systemConfig.superbed.token = 'secret-token'
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        err: 1,
        msg: 'upload rejected',
      }),
    )

    let thrownError: unknown
    try {
      await provider.upload(
        {
          ...createFile(),
          finalName: 'token = secret-token.jpg',
          originalName: 'Bearer secret-token.jpg',
        },
        systemConfig,
      )
    } catch (error) {
      thrownError = error
    }

    expect(thrownError).toMatchObject({
      cause: {
        finalName: '[REDACTED]',
        originalName: 'Bearer [REDACTED]',
      },
    })
    expect(JSON.stringify(thrownError)).not.toContain('secret-token')
  })

  it('posts delete requests to the official delete endpoint', async () => {
    const provider = new SuperbedUploadProvider()
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        err: 0,
      }),
    )

    await expect(
      provider.delete(
        {
          provider: 'superbed' as never,
          filePath: 'https://pic.superbed.cn/item/001.jpg',
        },
        createSystemConfig(),
      ),
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.superbed.cn/delete',
      expect.objectContaining({
        body: JSON.stringify({
          token: 'token',
          urls: ['https://pic.superbed.cn/item/001.jpg'],
        }),
        headers: expect.objectContaining({
          'content-type': 'application/json',
        }),
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )
  })
})
