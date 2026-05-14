import type { PreparedUploadFile, UploadSystemConfig } from './upload.type'
import axios from 'axios'
import { SuperbedUploadProvider } from './superbed-upload.provider'

jest.mock('axios', () => ({
  isAxiosError: jest.fn(
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'isAxiosError' in error &&
      error.isAxiosError === true,
  ),
  post: jest.fn(),
}))

describe('SuperbedUploadProvider', () => {
  const mockedAxiosPost = jest.mocked(axios.post)

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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a delete target that can be replayed during rollback', async () => {
    const provider = new SuperbedUploadProvider()
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        err: 0,
        url: 'https://pic.superbed.cn/item/001.jpg',
      },
    })

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).resolves.toEqual({
      filePath: 'https://pic.superbed.cn/item/001.jpg',
      deleteTarget: {
        provider: 'superbed',
        filePath: 'https://pic.superbed.cn/item/001.jpg',
      },
    })
  })

  it('preserves sanitized Superbed upload response diagnostics on provider failure', async () => {
    const provider = new SuperbedUploadProvider()
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        err: 1,
        msg: 'api quota exceeded',
        token: 'secret-token',
      },
    })

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).rejects.toMatchObject({
      message: 'api quota exceeded',
      cause: {
        provider: 'superbed',
        operation: 'upload',
        responseData: {
          err: 1,
          msg: 'api quota exceeded',
        },
      },
    })
  })

  it('preserves sanitized axios diagnostics when Superbed upload request fails', async () => {
    const provider = new SuperbedUploadProvider()
    mockedAxiosPost.mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ECONNABORTED',
      message: 'timeout of 30000ms exceeded',
      response: {
        status: 504,
        statusText: 'Gateway Timeout',
        data: {
          err: 1,
          msg: 'timeout',
          token: 'secret-token',
        },
      },
      config: {
        headers: { Authorization: 'Bearer secret-token' },
      },
    })

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).rejects.toMatchObject({
      message: 'Superbed 上传失败',
      cause: {
        provider: 'superbed',
        operation: 'upload',
        axiosCode: 'ECONNABORTED',
        httpStatus: 504,
        statusText: 'Gateway Timeout',
        responseData: {
          err: 1,
          msg: 'timeout',
        },
      },
    })
  })

  it('preserves sanitized Superbed delete response diagnostics on provider failure', async () => {
    const provider = new SuperbedUploadProvider()
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        err: 1,
        msg: 'delete denied',
        token: 'secret-token',
      },
    })

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
    mockedAxiosPost.mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ECONNABORTED',
      response: {
        status: 504,
        data: {
          err: 1,
          msg: 'timeout',
          token: 'secret-token',
          headers: { authorization: 'Bearer secret-token' },
        },
      },
      config: {
        headers: { Authorization: 'Bearer secret-token' },
        token: 'secret-token',
      },
    })

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
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        err: 1,
        msg: 'token = secret-token quota exceeded',
        message: '"token": "secret-token"',
        error: 'Bearer secret-token',
      },
    })

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

  it('posts delete requests to the official delete endpoint', async () => {
    const provider = new SuperbedUploadProvider()
    mockedAxiosPost.mockResolvedValueOnce({
      data: {
        err: 0,
      },
    })

    await expect(
      provider.delete(
        {
          provider: 'superbed' as never,
          filePath: 'https://pic.superbed.cn/item/001.jpg',
        },
        createSystemConfig(),
      ),
    ).resolves.toBeUndefined()

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      'https://api.superbed.cn/delete',
      {
        token: 'token',
        urls: ['https://pic.superbed.cn/item/001.jpg'],
      },
    )
  })
})
