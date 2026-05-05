import type { UploadConfigInterface } from '@libs/platform/config'
import type { Readable } from 'node:stream'
import type { PreparedUploadFile, UploadSystemConfig } from './upload.type'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable as NodeReadable } from 'node:stream'
import { UploadConfig } from '@libs/platform/config'
import { BadRequestException } from '@nestjs/common'
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type'
import { UploadProviderEnum } from './upload.type'
import { UploadService } from './upload.service'

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}))

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=',
  'base64',
)

const TEXT_BYTES = Buffer.from('hello upload')

function createUploadConfig(tempRoot: string): UploadConfigInterface {
  return {
    ...UploadConfig,
    localDir: join(tempRoot, 'local'),
    tmpDir: join(tempRoot, 'tmp'),
  } as UploadConfigInterface
}

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

function createMultipartRequest(options: {
  body: Buffer
  filename: string
  mimetype: string
  scene?: string
}) {
  const file = NodeReadable.from([options.body]) as Readable & {
    truncated?: boolean
  }
  file.truncated = false

  return {
    file: jest.fn(async () => ({
      file,
      filename: options.filename,
      mimetype: options.mimetype,
      fields:
        options.scene === undefined
          ? {}
          : { scene: { type: 'field', value: options.scene } },
    })),
  }
}

function createUploadService(
  uploadConfig: UploadConfigInterface,
  systemUploadConfig = createSystemUploadConfig(UploadProviderEnum.LOCAL),
) {
  const configService = {
    get: jest.fn().mockReturnValue(uploadConfig),
  }
  const localUploadProvider = {
    upload: jest.fn(async (file: { objectKey: string }) => ({
      filePath: `/files/${file.objectKey}`,
    })),
  }
  const qiniuUploadProvider = {
    upload: jest.fn(async (file: { objectKey: string }) => ({
      filePath: `https://cdn.example.com/uploads/${file.objectKey}`,
    })),
  }
  const superbedUploadProvider = {
    upload: jest.fn(async () => ({
      filePath: 'https://pic1.imgdb.cn/item/photo.png',
    })),
  }
  const uploadConfigProvider = {
    getUploadConfig: jest.fn(() => systemUploadConfig),
  }

  return {
    service: new UploadService(
      configService as never,
      localUploadProvider as never,
      qiniuUploadProvider as never,
      superbedUploadProvider as never,
      uploadConfigProvider,
    ),
    mocks: {
      localUploadProvider,
      qiniuUploadProvider,
      superbedUploadProvider,
      uploadConfigProvider,
    },
  }
}

describe('UploadService', () => {
  let tempRoot: string

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'upload-service-'))
  })

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true })
    jest.clearAllMocks()
  })

  it('appends image dimensions to finalName when uploading local images', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(uploadConfig)
    const imagePath = join(tempRoot, 'cover.png')
    await writeFile(imagePath, ONE_PIXEL_PNG)
    jest.mocked(fileTypeFromFile).mockResolvedValueOnce({
      ext: 'png',
      mime: 'image/png',
    } as never)

    const result = await service.uploadLocalFile({
      localPath: imagePath,
      objectKeySegments: ['shared', 'cover'],
      finalName: 'cover',
    })

    expect(mocks.localUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        finalName: 'cover-1x1.png',
        objectKey: 'shared/cover/cover-1x1.png',
        fileCategory: 'image',
      }),
    )
    expect(result.filename).toBe('cover-1x1.png')
    expect(result.filePath).toBe('/files/shared/cover/cover-1x1.png')
    expect(result.fileCategory).toBe('image')
    expect(result.width).toBe(1)
    expect(result.height).toBe(1)
  })

  it('keeps non-image finalName unchanged when uploading local files', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(uploadConfig)
    const textPath = join(tempRoot, 'notes.txt')
    await writeFile(textPath, 'hello upload')
    jest.mocked(fileTypeFromFile).mockResolvedValueOnce(undefined)

    const result = await service.uploadLocalFile({
      localPath: textPath,
      objectKeySegments: ['shared', 'docs'],
      finalName: 'notes',
    })

    expect(mocks.localUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        finalName: 'notes.txt',
        objectKey: 'shared/docs/notes.txt',
        fileCategory: 'document',
      }),
    )
    expect(result.filename).toBe('notes.txt')
    expect(result.filePath).toBe('/files/shared/docs/notes.txt')
    expect(result.fileCategory).toBe('document')
    expect(result.width).toBeUndefined()
    expect(result.height).toBeUndefined()
  })

  it('keeps configured provider behavior when uploadFile has no options', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(
      uploadConfig,
      createSystemUploadConfig(UploadProviderEnum.SUPERBED),
    )
    jest.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
      ext: 'png',
      mime: 'image/png',
    } as never)

    const result = await service.uploadFile(
      createMultipartRequest({
        body: ONE_PIXEL_PNG,
        filename: 'photo.png',
        mimetype: 'image/png',
        scene: 'shared',
      }) as never,
    )

    expect(mocks.superbedUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: expect.stringMatching(/^shared\/image\//),
        fileCategory: 'image',
        scene: 'shared',
      }),
      expect.objectContaining({ provider: UploadProviderEnum.SUPERBED }),
    )
    expect(mocks.localUploadProvider.upload).not.toHaveBeenCalled()
    expect(result.filePath).toBe('https://pic1.imgdb.cn/item/photo.png')
    expect(result.scene).toBe('shared')
  })

  it('uses sceneOverride without validating the multipart scene field', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(uploadConfig)
    jest.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
      ext: 'png',
      mime: 'image/png',
    } as never)

    const result = await service.uploadFile(
      createMultipartRequest({
        body: ONE_PIXEL_PNG,
        filename: 'photo.png',
        mimetype: 'image/png',
        scene: 'invalid scene',
      }) as never,
      undefined,
      { sceneOverride: 'chat' },
    )

    expect(mocks.localUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: expect.stringMatching(/^chat\/image\//),
        scene: 'chat',
      }),
    )
    expect(result.scene).toBe('chat')
    expect(result.filePath).toContain('/files/chat/image/')
  })

  it('rejects disallowed file categories before provider execution', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(uploadConfig)
    jest.mocked(fileTypeFromBuffer).mockResolvedValueOnce(undefined)

    await expect(
      service.uploadFile(
        createMultipartRequest({
          body: TEXT_BYTES,
          filename: 'notes.txt',
          mimetype: 'text/plain',
          scene: 'chat',
        }) as never,
        undefined,
        { allowedFileCategories: ['image', 'audio', 'video'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(mocks.localUploadProvider.upload).not.toHaveBeenCalled()
    expect(mocks.qiniuUploadProvider.upload).not.toHaveBeenCalled()
    expect(mocks.superbedUploadProvider.upload).not.toHaveBeenCalled()
  })

  it('uses provider resolver before executing the configured provider', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(
      uploadConfig,
      createSystemUploadConfig(UploadProviderEnum.SUPERBED),
    )
    jest.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
      ext: 'png',
      mime: 'image/png',
    } as never)

    const result = await service.uploadFile(
      createMultipartRequest({
        body: ONE_PIXEL_PNG,
        filename: 'photo.png',
        mimetype: 'image/png',
        scene: 'chat',
      }) as never,
      undefined,
      {
        resolveProvider: (context) => {
          expect(context.configuredProvider).toBe(UploadProviderEnum.SUPERBED)
          expect(context.defaultProvider).toBe(UploadProviderEnum.SUPERBED)
          expect((context.file as PreparedUploadFile).scene).toBe('chat')
          return UploadProviderEnum.LOCAL
        },
      },
    )

    expect(mocks.localUploadProvider.upload).toHaveBeenCalled()
    expect(mocks.superbedUploadProvider.upload).not.toHaveBeenCalled()
    expect(result.filePath).toContain('/files/chat/image/')
  })

  it('does not fall back to local when provider execution fails', async () => {
    const uploadConfig = createUploadConfig(tempRoot)
    const { service, mocks } = createUploadService(
      uploadConfig,
      createSystemUploadConfig(UploadProviderEnum.QINIU),
    )
    mocks.qiniuUploadProvider.upload.mockRejectedValueOnce(
      new Error('qiniu unavailable'),
    )
    jest.mocked(fileTypeFromBuffer).mockResolvedValueOnce({
      ext: 'png',
      mime: 'image/png',
    } as never)

    await expect(
      service.uploadFile(
        createMultipartRequest({
          body: ONE_PIXEL_PNG,
          filename: 'photo.png',
          mimetype: 'image/png',
          scene: 'chat',
        }) as never,
      ),
    ).rejects.toThrow('上传文件失败')

    expect(mocks.qiniuUploadProvider.upload).toHaveBeenCalled()
    expect(mocks.localUploadProvider.upload).not.toHaveBeenCalled()
  })
})
