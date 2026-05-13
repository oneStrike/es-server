import type { PreparedUploadFile, UploadSystemConfig } from './upload.type'
import { InternalServerErrorException } from '@nestjs/common'
import { QiniuUploadProvider } from './qiniu-upload.provider'

const deleteMock = jest.fn()
const putFileMock = jest.fn()

jest.mock('qiniu', () => {
  const uploadTokenMock = jest.fn(() => 'upload-token')
  return {
    auth: {
      digest: {
        Mac: jest.fn(),
      },
    },
    rs: {
      PutPolicy: jest.fn(() => ({
        uploadToken: uploadTokenMock,
      })),
      BucketManager: jest.fn(() => ({
        delete: deleteMock,
      })),
    },
    conf: {
      Config: jest.fn(() => ({})),
    },
    httpc: {
      Region: {
        fromRegionId: jest.fn(() => 'region'),
      },
    },
    form_up: {
      FormUploader: jest.fn(() => ({
        putFile: putFileMock,
      })),
      PutExtra: jest.fn(),
    },
  }
})

describe('QiniuUploadProvider', () => {
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
      provider: 'qiniu' as never,
      superbedNonImageFallbackToLocal: true,
      qiniu: {
        accessKey: 'ak',
        secretKey: 'sk',
        bucket: 'bucket',
        domain: 'cdn.example.com',
        region: 'z0',
        pathPrefix: 'prefix',
        useHttps: true,
        tokenExpires: 3600,
      },
      superbed: {
        token: '',
        categories: '',
      },
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a provider delete target that preserves the resolved object key', async () => {
    const provider = new QiniuUploadProvider()
    putFileMock.mockResolvedValue({
      resp: { statusCode: 200 },
      data: {},
    })

    await expect(
      provider.upload(createFile(), createSystemConfig()),
    ).resolves.toEqual({
      filePath: 'https://cdn.example.com/prefix/comic/image/001.jpg',
      deleteTarget: {
        provider: 'qiniu',
        filePath: 'https://cdn.example.com/prefix/comic/image/001.jpg',
        objectKey: 'prefix/comic/image/001.jpg',
      },
    })
  })

  it('treats missing remote objects as idempotent delete success', async () => {
    const provider = new QiniuUploadProvider()
    deleteMock.mockResolvedValue({
      resp: { statusCode: 612 },
      data: {},
    })

    await expect(
      provider.delete(
        {
          provider: 'qiniu' as never,
          filePath: 'https://cdn.example.com/prefix/comic/image/001.jpg',
          objectKey: 'prefix/comic/image/001.jpg',
        },
        createSystemConfig(),
      ),
    ).resolves.toBeUndefined()
  })

  it('rejects deletes without an object key', async () => {
    const provider = new QiniuUploadProvider()

    await expect(
      provider.delete(
        {
          provider: 'qiniu' as never,
          filePath: 'https://cdn.example.com/prefix/comic/image/001.jpg',
        },
        createSystemConfig(),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException)
  })
})
