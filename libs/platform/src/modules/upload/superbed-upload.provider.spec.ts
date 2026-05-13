import type { PreparedUploadFile, UploadSystemConfig } from './upload.type'
import axios from 'axios'
import { SuperbedUploadProvider } from './superbed-upload.provider'

jest.mock('axios', () => ({
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
