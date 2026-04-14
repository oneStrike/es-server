import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

jest.mock(
  'file-type',
  () => ({
    fileTypeFromBuffer: jest.fn().mockResolvedValue({
      ext: 'zip',
      mime: 'application/zip',
    }),
    fileTypeFromFile: jest.fn().mockResolvedValue({
      ext: 'zip',
      mime: 'application/zip',
    }),
  }),
  { virtual: true },
)

jest.mock(
  'uuid',
  () => ({
    v4: jest.fn(() => 'mocked-uuid'),
  }),
  { virtual: true },
)

describe('upload service install package support', () => {
  const createUploadConfig = () => ({
    maxFileSize: 100 * 1024 * 1024,
    localDir: 'E:/tmp/uploads/public',
    tmpDir: 'E:/tmp/uploads/tmp',
    localUrlPrefix: '/files',
    allowExtensions: {
      image: ['png'],
      audio: ['mp3'],
      video: ['mp4'],
      document: ['pdf'],
      archive: ['zip'],
      package: ['apk', 'ipa'],
    },
    allowExtensionsFlat: ['png', 'mp3', 'mp4', 'pdf', 'zip', 'apk', 'ipa'],
    allowMimeTypes: {
      image: ['image/png'],
      audio: ['audio/mpeg'],
      video: ['video/mp4'],
      document: ['application/pdf'],
      archive: ['application/zip'],
      package: [
        'application/vnd.android.package-archive',
        'application/octet-stream',
      ],
    },
    allowMimeTypesFlat: [
      'image/png',
      'audio/mpeg',
      'video/mp4',
      'application/pdf',
      'application/zip',
      'application/vnd.android.package-archive',
      'application/octet-stream',
    ],
  })

  const createService = async () => {
    const { UploadService } = await import('./upload.service')
    const config = createUploadConfig()
    const configService = {
      get: jest.fn().mockReturnValue(config),
    }
    const localUploadProvider = {
      upload: jest.fn().mockResolvedValue({ filePath: '/files/appupdate/app.ipa' }),
    }

    const service = new UploadService(
      configService as any,
      localUploadProvider as any,
      { upload: jest.fn() } as any,
      { upload: jest.fn() } as any,
      undefined,
    )

    return { service, localUploadProvider }
  }

  it('treats ipa files as install packages even when file-type reports zip', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'upload-service-ipa-'))
    const ipaPath = join(tempDir, 'release.ipa')
    writeFileSync(
      ipaPath,
      Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
    )

    const { service, localUploadProvider } = await createService()

    await service.uploadLocalFile({
      localPath: ipaPath,
      objectKeySegments: ['appupdate'],
      originalName: 'release.ipa',
    })

    expect(localUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        ext: 'ipa',
        fileCategory: 'package',
        mimeType: 'application/octet-stream',
      }),
    )
  })

  it('treats apk files as install packages even when file-type reports zip', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'upload-service-apk-'))
    const apkPath = join(tempDir, 'release.apk')
    writeFileSync(
      apkPath,
      Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
    )

    const { service, localUploadProvider } = await createService()

    await service.uploadLocalFile({
      localPath: apkPath,
      objectKeySegments: ['appupdate'],
      originalName: 'release.apk',
    })

    expect(localUploadProvider.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        ext: 'apk',
        fileCategory: 'package',
        mimeType: 'application/vnd.android.package-archive',
      }),
    )
  })
})
