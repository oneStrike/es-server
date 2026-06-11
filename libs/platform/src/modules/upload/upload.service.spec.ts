/// <reference types="jest" />

import type { ConfigService } from '@nestjs/config'
import type { UploadFileOptions } from './upload.type'
import { UploadService } from './upload.service'

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}))

jest.mock('uuid', () => ({ v4: jest.fn(() => 'upload-test-id') }))

interface UploadSceneResolver {
  resolveUploadScene: (options: UploadFileOptions) => string | null
}

describe('UploadService scene resolution', () => {
  const createService = () => {
    const configService = {
      get: jest.fn().mockReturnValue({
        allowExtensions: { image: ['png'] },
        allowMimeTypesFlat: ['image/png'],
        localDir: '/tmp/upload-local',
        localUrlPrefix: '/files',
        maxFileSize: 1024,
        tmpDir: '/tmp/upload-tmp',
      }),
    } as unknown as ConfigService

    return new UploadService(
      configService,
      {} as ConstructorParameters<typeof UploadService>[1],
      {} as ConstructorParameters<typeof UploadService>[2],
      {} as ConstructorParameters<typeof UploadService>[3],
    ) as unknown as UploadSceneResolver
  }

  it('uses query DTO scene when provided', () => {
    const service = createService()

    expect(service.resolveUploadScene({ sceneOverride: 'content' })).toBe(
      'content',
    )
  })

  it('defaults generic uploads to shared when no scene is provided', () => {
    const service = createService()

    expect(service.resolveUploadScene({})).toBe('shared')
  })

  it('rejects invalid query DTO scene values instead of silently defaulting', () => {
    const service = createService()

    expect(service.resolveUploadScene({ sceneOverride: '../avatar' })).toBeNull()
  })
})
