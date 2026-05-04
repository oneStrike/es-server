import type { UploadConfigInterface } from '@libs/platform/config'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { UploadConfig } from '@libs/platform/config'
import { fileTypeFromFile } from 'file-type'
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

function createUploadConfig(tempRoot: string): UploadConfigInterface {
  return {
    ...UploadConfig,
    localDir: join(tempRoot, 'local'),
    tmpDir: join(tempRoot, 'tmp'),
  } as UploadConfigInterface
}

function createUploadService(uploadConfig: UploadConfigInterface) {
  const configService = {
    get: jest.fn().mockReturnValue(uploadConfig),
  }
  const localUploadProvider = {
    upload: jest.fn(async (file: { objectKey: string }) => ({
      filePath: `/files/${file.objectKey}`,
    })),
  }

  return {
    service: new UploadService(
      configService as never,
      localUploadProvider as never,
      { upload: jest.fn() } as never,
      { upload: jest.fn() } as never,
    ),
    mocks: {
      localUploadProvider,
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
})
