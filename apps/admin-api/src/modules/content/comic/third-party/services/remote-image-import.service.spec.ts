import type { UploadService } from '@libs/platform/modules/upload/upload.service'
import type { ConfigReader } from '@libs/system-config/config-reader'
import type { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { lookup } from 'node:dns/promises'
import { promises as fs } from 'node:fs'
import { RemoteImageImportService } from './remote-image-import.service'

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class UploadService {},
}))

jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}))

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'remote-image-id'),
}))

describe('RemoteImageImportService', () => {
  const mockedAxiosGet = jest.mocked(axios.get)
  const mockedLookup = jest.mocked(lookup)
  const uploadTmpDir = 'D:\\code\\es\\es-server\\uploads\\tmp'
  const tempDir = `${uploadTmpDir}\\third-party-comic-test`

  function mockLookupAddresses(
    addresses: Array<{ address: string; family: 4 | 6 }>,
  ) {
    mockedLookup.mockResolvedValueOnce(addresses as never)
  }

  function createService(enableAddressGuard = true) {
    const uploadService = {
      uploadLocalFile: jest.fn(async () => ({
        filePath: '/uploads/comic/remote.jpg',
      })),
    }
    const configReader = {
      getRemoteImageImportSecurityConfig: jest.fn(() => ({
        enableAddressGuard,
      })),
    }
    const configService = {
      get: jest.fn((key: string) =>
        key === 'upload'
          ? {
              tmpDir: uploadTmpDir,
            }
          : undefined,
      ),
    }

    return {
      service: new RemoteImageImportService(
        uploadService as unknown as UploadService,
        configReader as unknown as ConfigReader,
        configService as unknown as ConfigService,
      ),
      configService,
      uploadService,
      configReader,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    jest.spyOn(fs, 'mkdtemp').mockResolvedValue(tempDir)
    jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined)
    jest.spyOn(fs, 'rm').mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses the validated DNS answer for the outbound image request by default', async () => {
    const { service, uploadService, configReader, configService } =
      createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockedAxiosGet.mockImplementationOnce(async (_url, config) => {
      const lookupFromAgent = config?.httpsAgent?.options?.lookup
      expect(lookupFromAgent).toBeDefined()

      await expect(
        new Promise((resolve, reject) => {
          lookupFromAgent?.(
            'sw.mangafunb.fun',
            {},
            (error, address, family) => {
              if (error) {
                reject(error)
                return
              }
              resolve({ address, family })
            },
          )
        }),
      ).resolves.toEqual({ address: '93.184.216.34', family: 4 })

      expect(mockedLookup).toHaveBeenCalledTimes(1)
      return {
        data: Buffer.from([1, 2, 3]),
        headers: { 'content-type': 'image/jpeg' },
      }
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', [
        'comic',
        'image',
      ]),
    ).resolves.toBe('/uploads/comic/remote.jpg')

    expect(uploadService.uploadLocalFile).toHaveBeenCalledWith(
      expect.objectContaining({
        localPath: expect.stringContaining('third-party-comic-test'),
        objectKeySegments: ['comic', 'image'],
        originalName: '001.jpg',
      }),
    )
    const uploadArg = (
      uploadService.uploadLocalFile.mock.calls as unknown as Array<
        [Record<string, unknown>]
      >
    )[0][0]
    expect(uploadArg).not.toHaveProperty('provider')
    expect(uploadArg).not.toHaveProperty('resolveProvider')
    expect(configService.get).toHaveBeenCalledWith('upload')
    expect(configReader.getRemoteImageImportSecurityConfig).toHaveBeenCalled()
    expect(fs.mkdir).toHaveBeenCalledWith(uploadTmpDir, { recursive: true })
    expect(fs.mkdtemp).toHaveBeenCalledWith(
      expect.stringContaining(uploadTmpDir),
    )
    expect(fs.mkdtemp).toHaveBeenCalledWith(
      expect.stringContaining('third-party-comic-'),
    )
    expect(fs.rm).toHaveBeenCalledWith(tempDir, {
      force: true,
      recursive: true,
    })
  })

  it('skips DNS address guard when system security config disables it', async () => {
    const { service, configReader } = createService(false)
    mockedAxiosGet.mockImplementationOnce(async (_url, config) => {
      expect(config?.httpsAgent).toBeUndefined()
      return {
        data: Buffer.from([1, 2, 3]),
        headers: { 'content-type': 'image/jpeg' },
      }
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).resolves.toBe('/uploads/comic/remote.jpg')

    expect(mockedLookup).not.toHaveBeenCalled()
    expect(configReader.getRemoteImageImportSecurityConfig).toHaveBeenCalled()
  })

  it('rejects non-HTTPS URLs before DNS lookup or download', async () => {
    const { service } = createService()

    await expect(
      service.importImage('http://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片必须使用 HTTPS')

    expect(mockedLookup).not.toHaveBeenCalled()
    expect(mockedAxiosGet).not.toHaveBeenCalled()
  })

  it('rejects non-allowlisted hosts before DNS lookup or download', async () => {
    const { service } = createService()

    await expect(
      service.importImage('https://example.com/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片域名不在允许范围内')

    expect(mockedLookup).not.toHaveBeenCalled()
    expect(mockedAxiosGet).not.toHaveBeenCalled()
  })

  it('rejects empty DNS answers before download', async () => {
    const { service } = createService()
    mockLookupAddresses([])

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片解析到不安全地址')

    expect(mockedAxiosGet).not.toHaveBeenCalled()
  })

  it.each([
    '0.0.0.1',
    '10.0.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '224.0.0.1',
    '240.0.0.1',
  ])('rejects unsafe IPv4 DNS answer %s', async (address) => {
    const { service } = createService()
    mockLookupAddresses([{ address, family: 4 }])

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片解析到不安全地址')

    expect(mockedAxiosGet).not.toHaveBeenCalled()
  })

  it.each(['::', '::1', 'fe80::1', 'fc00::1', 'fd00::1', 'ff00::1'])(
    'rejects unsafe IPv6 DNS answer %s',
    async (address) => {
      const { service } = createService()
      mockLookupAddresses([{ address, family: 6 }])

      await expect(
        service.importImage('https://sw.mangafunb.fun/comic/001.jpg', [
          'comic',
        ]),
      ).rejects.toThrow('远程图片解析到不安全地址')

      expect(mockedAxiosGet).not.toHaveBeenCalled()
    },
  )

  it('rejects unsafe IPv4-mapped IPv6 DNS answers', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '::ffff:127.0.0.1', family: 6 }])

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片解析到不安全地址')

    expect(mockedAxiosGet).not.toHaveBeenCalled()
  })

  it('rejects non-image content types', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockedAxiosGet.mockResolvedValueOnce({
      data: Buffer.from('not image'),
      headers: { 'content-type': 'text/html' },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程资源不是图片')
  })

  it('rejects oversized image payloads', async () => {
    const { service } = createService()
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockedAxiosGet.mockResolvedValueOnce({
      data: Buffer.alloc(10 * 1024 * 1024 + 1),
      headers: { 'content-type': 'image/jpeg' },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('远程图片大小超过限制')
  })

  it('removes the temporary directory when upload fails', async () => {
    const { service, uploadService } = createService()
    uploadService.uploadLocalFile.mockRejectedValueOnce(
      new Error('upload failed'),
    )
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockedAxiosGet.mockResolvedValueOnce({
      data: Buffer.from([1, 2, 3]),
      headers: { 'content-type': 'image/jpeg' },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('upload failed')

    expect(fs.rm).toHaveBeenCalledWith(tempDir, {
      force: true,
      recursive: true,
    })
  })

  it('removes the temporary directory when writing the downloaded file fails', async () => {
    const { service, uploadService } = createService()
    jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('write failed'))
    mockLookupAddresses([{ address: '93.184.216.34', family: 4 }])
    mockedAxiosGet.mockResolvedValueOnce({
      data: Buffer.from([1, 2, 3]),
      headers: { 'content-type': 'image/jpeg' },
    })

    await expect(
      service.importImage('https://sw.mangafunb.fun/comic/001.jpg', ['comic']),
    ).rejects.toThrow('write failed')

    expect(uploadService.uploadLocalFile).not.toHaveBeenCalled()
    expect(fs.rm).toHaveBeenCalledWith(tempDir, {
      force: true,
      recursive: true,
    })
  })
})
