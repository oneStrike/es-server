import type { UploadConfigInterface } from '@libs/platform/config'
import type {
  PreparedUploadFile,
  UploadResult,
  UploadSystemConfig,
} from '@libs/platform/modules/upload/upload.type'
import { InternalServerErrorException } from '@nestjs/common'
import { UploadConfig } from '@libs/platform/config'
import { UploadProviderEnum } from '@libs/platform/modules/upload/upload.type'
import { MessageChatUploadService } from './chat-upload.service'

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}))

function createSystemUploadConfig(
  provider: UploadProviderEnum,
): UploadSystemConfig {
  return {
    provider,
    superbedNonImageFallbackToLocal: true,
    qiniu: {
      accessKey: 'ak',
      secretKey: 'sk',
      bucket: 'bucket',
      domain: 'cdn.example.com',
      region: 'z0',
      pathPrefix: 'uploads',
      useHttps: true,
      tokenExpires: 3600,
    },
    superbed: {
      token: 'token',
      categories: 'chat',
    },
  }
}

function createUploadResult(
  override: Partial<UploadResult> = {},
): UploadResult {
  return {
    filename: 'photo.png',
    originalName: 'photo.png',
    filePath: '/files/chat/image/2026-05-04/photo.png',
    fileSize: 1024,
    mimeType: 'image/png',
    fileType: 'png',
    fileCategory: 'image',
    scene: 'chat',
    uploadTime: new Date('2026-05-04T00:00:00.000Z'),
    ...override,
  }
}

function createPreparedUploadFile(
  override: Partial<PreparedUploadFile> = {},
): PreparedUploadFile {
  return {
    tempPath: 'tmp',
    objectKey: 'chat/image/2026-05-04/photo.png',
    finalName: 'photo.png',
    originalName: 'photo.png',
    mimeType: 'image/png',
    ext: 'png',
    fileCategory: 'image',
    scene: 'chat',
    fileSize: 1024,
    ...override,
  }
}

function createService(options: {
  provider: UploadProviderEnum
  uploadResult?: UploadResult
  uploadError?: Error
}) {
  const uploadConfig = UploadConfig as UploadConfigInterface
  const systemUploadConfig = createSystemUploadConfig(options.provider)
  const uploadService = {
    uploadFile: jest.fn(),
  }
  if (options.uploadError) {
    uploadService.uploadFile.mockRejectedValue(options.uploadError)
  } else {
    uploadService.uploadFile.mockResolvedValue(
      options.uploadResult ?? createUploadResult(),
    )
  }

  const configService = {
    get: jest.fn().mockReturnValue(uploadConfig),
  }
  const uploadConfigProvider = {
    getUploadConfig: jest.fn(() => systemUploadConfig),
  }

  const service = new MessageChatUploadService(
    uploadService as never,
    configService as never,
    uploadConfigProvider,
  )

  return {
    service,
    mocks: {
      uploadService,
      configService,
      uploadConfigProvider,
      systemUploadConfig,
    },
  }
}

describe('MessageChatUploadService', () => {
  it('forces chat scene and media categories when uploading', async () => {
    const { service, mocks } = createService({
      provider: UploadProviderEnum.LOCAL,
    })
    const req = { file: jest.fn() }

    const result = await service.uploadMedia(req as never)

    expect(mocks.uploadService.uploadFile).toHaveBeenCalledWith(
      req,
      undefined,
      expect.objectContaining({
        sceneOverride: 'chat',
        allowedFileCategories: ['image', 'audio', 'video'],
      }),
    )
    expect(result.scene).toBe('chat')
  })

  it('routes Superbed chat media to local before upload execution', async () => {
    const { service, mocks } = createService({
      provider: UploadProviderEnum.SUPERBED,
    })

    await service.uploadMedia({ file: jest.fn() } as never)

    const options = mocks.uploadService.uploadFile.mock.calls[0]?.[2]
    expect(
      options.resolveProvider({
        file: createPreparedUploadFile(),
        systemConfig: mocks.systemUploadConfig,
        configuredProvider: UploadProviderEnum.SUPERBED,
        defaultProvider: UploadProviderEnum.SUPERBED,
      }),
    ).toBe(UploadProviderEnum.LOCAL)
  })

  it('keeps compatible providers on the default provider path', async () => {
    const { service, mocks } = createService({
      provider: UploadProviderEnum.QINIU,
    })

    await service.uploadMedia({ file: jest.fn() } as never)

    const options = mocks.uploadService.uploadFile.mock.calls[0]?.[2]
    expect(
      options.resolveProvider({
        file: createPreparedUploadFile(),
        systemConfig: mocks.systemUploadConfig,
        configuredProvider: UploadProviderEnum.QINIU,
        defaultProvider: UploadProviderEnum.QINIU,
      }),
    ).toBeUndefined()
  })

  it('rejects upload results that fail the chat media origin policy', async () => {
    const { service } = createService({
      provider: UploadProviderEnum.SUPERBED,
      uploadResult: createUploadResult({
        filePath: 'https://pic1.imgdb.cn/item/photo.png',
      }),
    })

    await expect(
      service.uploadMedia({ file: jest.fn() } as never),
    ).rejects.toBeInstanceOf(InternalServerErrorException)
  })

  it('propagates provider failures without fallback', async () => {
    const uploadError = new Error('qiniu unavailable')
    const { service, mocks } = createService({
      provider: UploadProviderEnum.QINIU,
      uploadError,
    })

    await expect(
      service.uploadMedia({ file: jest.fn() } as never),
    ).rejects.toBe(uploadError)
    expect(mocks.uploadService.uploadFile).toHaveBeenCalledTimes(1)
  })
})
