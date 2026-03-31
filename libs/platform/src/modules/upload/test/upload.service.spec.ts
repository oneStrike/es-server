import type { UploadConfigInterface } from '@libs/platform/config'
import type { PreparedUploadFile } from '../upload.types'
import { Buffer } from 'node:buffer'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { UploadConfig } from '@libs/platform/config'
import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common'
import { UploadService } from '../upload.service'

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(async () => ({
    ext: 'png',
    mime: 'image/png',
  })),
  fileTypeFromFile: jest.fn(async () => ({
    ext: 'png',
    mime: 'image/png',
  })),
}), { virtual: true })
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-upload-id'),
}), { virtual: true })

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64',
)

function createUploadConfig(
  workspaceDir: string,
  maxFileSize = 1024 * 1024,
): UploadConfigInterface {
  return {
    ...UploadConfig,
    localDir: join(workspaceDir, 'public'),
    tmpDir: join(workspaceDir, 'tmp'),
    maxFileSize,
  }
}

function createUploadService(uploadConfig: UploadConfigInterface) {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'upload') {
        return uploadConfig
      }

      return undefined
    }),
  }
  const localUploadProvider = {
    upload: jest.fn(async (file: PreparedUploadFile) => ({
      filePath: `/files/${file.objectKey}`,
    })),
  }
  const qiniuUploadProvider = {
    upload: jest.fn(),
  }
  const superbedUploadProvider = {
    upload: jest.fn(),
  }

  return {
    service: new UploadService(
      configService as any,
      localUploadProvider as any,
      qiniuUploadProvider as any,
      superbedUploadProvider as any,
    ),
    localUploadProvider,
  }
}

function createFastifyRequest(buffer: Buffer, sceneField?: unknown) {
  const stream = Readable.from(buffer) as Readable & { truncated?: boolean }
  stream.truncated = false

  return {
    file: jest.fn(async () => ({
      file: stream,
      fields: sceneField === undefined ? {} : { scene: sceneField },
      filename: 'avatar.png',
      mimetype: 'image/png',
    })),
  }
}

async function createWorkspace() {
  return mkdtemp(join(tmpdir(), 'upload-service-spec-'))
}

async function createLocalFile(workspaceDir: string, filename = 'image.png') {
  const filePath = join(workspaceDir, filename)
  await writeFile(filePath, PNG_BUFFER)
  return filePath
}

describe('upload service', () => {
  const workspaceDirs: string[] = []

  afterEach(async () => {
    for (const workspaceDir of workspaceDirs) {
      await rm(workspaceDir, { recursive: true, force: true })
    }
    workspaceDirs.length = 0
    jest.clearAllMocks()
  })

  it('defaults scene to shared when multipart field is absent', async () => {
    const workspaceDir = await createWorkspace()
    workspaceDirs.push(workspaceDir)
    const { service, localUploadProvider } = createUploadService(
      createUploadConfig(workspaceDir),
    )

    const result = await service.uploadFile(createFastifyRequest(PNG_BUFFER) as any)

    expect(result.scene).toBe('shared')
    expect(localUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        scene: 'shared',
        objectKey: expect.stringMatching(/^shared\//),
      }),
    )
  })

  it('rejects invalid scene values even when scene is optional', async () => {
    const workspaceDir = await createWorkspace()
    workspaceDirs.push(workspaceDir)
    const { service, localUploadProvider } = createUploadService(
      createUploadConfig(workspaceDir),
    )

    await expect(
      service.uploadFile(
        createFastifyRequest(PNG_BUFFER, {
          type: 'field',
          value: '../avatar',
        }) as any,
      ),
    ).rejects.toThrow(new BadRequestException('未知的上传场景'))
    expect(localUploadProvider.upload).not.toHaveBeenCalled()
  })

  it('rejects reserved path segments for local uploads', async () => {
    const workspaceDir = await createWorkspace()
    workspaceDirs.push(workspaceDir)
    const localPath = await createLocalFile(workspaceDir)
    const { service, localUploadProvider } = createUploadService(
      createUploadConfig(workspaceDir),
    )

    await expect(
      service.uploadLocalFile({
        localPath,
        objectKeySegments: ['comic', '..', 'chapter'],
      }),
    ).rejects.toThrow(new BadRequestException('上传路径不合法'))
    expect(localUploadProvider.upload).not.toHaveBeenCalled()
  })

  it('enforces max file size for local uploads', async () => {
    const workspaceDir = await createWorkspace()
    workspaceDirs.push(workspaceDir)
    const localPath = await createLocalFile(workspaceDir, 'oversized.png')
    const { service, localUploadProvider } = createUploadService(
      createUploadConfig(workspaceDir, 10),
    )

    await expect(
      service.uploadLocalFile({
        localPath,
        objectKeySegments: ['comic', '1', 'chapter', '2'],
      }),
    ).rejects.toThrow(new PayloadTooLargeException('文件大小超过限制'))
    expect(localUploadProvider.upload).not.toHaveBeenCalled()
  })
})
