import type { ConfigService } from '@nestjs/config'
import type { PreparedUploadFile } from './upload.type'
import { mkdir, rename } from 'node:fs/promises'
import { LocalUploadProvider } from './local-upload.provider'

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  rename: jest.fn(),
}))

describe('LocalUploadProvider', () => {
  const mockedMkdir = jest.mocked(mkdir)
  const mockedRename = jest.mocked(rename)

  function createProvider() {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'upload'
          ? {
              localDir: 'D:\\code\\es\\es-server\\uploads\\public',
              localUrlPrefix: '/files',
            }
          : undefined,
      ),
    }

    return new LocalUploadProvider(configService as unknown as ConfigService)
  }

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

  beforeEach(() => {
    jest.clearAllMocks()
    mockedMkdir.mockResolvedValue(undefined)
    mockedRename.mockResolvedValue(undefined)
  })

  it('moves a local upload with rename and returns the public file path', async () => {
    const provider = createProvider()

    await expect(provider.upload(createFile())).resolves.toEqual({
      filePath: '/files/comic/image/001.jpg',
      deleteTarget: {
        provider: 'local',
        filePath: '/files/comic/image/001.jpg',
        objectKey: 'comic/image/001.jpg',
      },
    })

    expect(mockedMkdir).toHaveBeenCalledTimes(1)
    expect(mockedRename).toHaveBeenCalledTimes(1)
  })

  it('propagates EXDEV when the temporary file is on another device', async () => {
    const provider = createProvider()
    const error = Object.assign(new Error('cross-device link not permitted'), {
      code: 'EXDEV',
    })
    mockedRename.mockRejectedValueOnce(error)

    await expect(provider.upload(createFile())).rejects.toMatchObject({
      code: 'EXDEV',
    })

    expect(mockedMkdir).toHaveBeenCalledTimes(1)
    expect(mockedRename).toHaveBeenCalledTimes(1)
  })
})
