import { Buffer } from 'node:buffer'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { BadRequestException } from '@nestjs/common'
import { Ip2regionService } from './ip2region.service'

jest.mock('@libs/platform/modules/geo', () => ({
  GeoService: class GeoService {},
  Ip2regionRuntimeStatusDto: class Ip2regionRuntimeStatusDto {},
}))

describe('ip2regionService', () => {
  const previousDataDir = process.env.IP2REGION_DATA_DIR

  let dataDir: string
  let geoService: {
    getRuntimeStatus: jest.Mock
    validateFile: jest.Mock
    reloadFromFile: jest.Mock
  }
  let logger: { log: jest.Mock, warn: jest.Mock }
  let loggerService: { getLoggerWithContext: jest.Mock }
  let service: Ip2regionService

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'ip2region-admin-'))
    process.env.IP2REGION_DATA_DIR = dataDir

    geoService = {
      getRuntimeStatus: jest.fn().mockResolvedValue({
        ready: false,
        source: 'unavailable',
        storageDir: dataDir,
      }),
      validateFile: jest.fn().mockResolvedValue(undefined),
      reloadFromFile: jest.fn(),
    }
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
    }
    loggerService = {
      getLoggerWithContext: jest.fn().mockReturnValue(logger),
    }

    service = new Ip2regionService(
      geoService as any,
      loggerService as any,
    )
  })

  afterEach(async () => {
    process.env.IP2REGION_DATA_DIR = previousDataDir
    await rm(dataDir, { recursive: true, force: true })
  })

  it('非法文件名不会触发热切换', async () => {
    const fileStream = Readable.from(Buffer.from('xdb'))
    ;(fileStream as any).truncated = false

    const request = {
      file: jest.fn().mockResolvedValue({
        filename: 'custom.xdb',
        file: fileStream,
      }),
    }

    await expect(service.uploadAndActivate(request as any, 9))
      .rejects
      .toBeInstanceOf(BadRequestException)

    expect(geoService.reloadFromFile).not.toHaveBeenCalled()
  })

  it('上传成功后会写入 active 元信息并触发当前进程热切换', async () => {
    const fileStream = Readable.from(Buffer.from('xdb-content'))
    ;(fileStream as any).truncated = false

    geoService.reloadFromFile.mockImplementation(
      async (filePath: string, info: any) => ({
        ready: true,
        source: 'managed-active',
        filePath,
        fileName: info.fileName,
        fileSize: info.fileSize,
        activatedAt: info.activatedAt,
        storageDir: dataDir,
      }),
    )

    const request = {
      file: jest.fn().mockResolvedValue({
        filename: 'ip2region_v4.xdb',
        file: fileStream,
      }),
    }

    const result = await service.uploadAndActivate(request as any, 9)
    const activeDirEntries = await readdir(join(dataDir, 'active'))
    const versionDirEntries = await readdir(join(dataDir, 'versions'))
    const metadata = JSON.parse(
      await readFile(join(dataDir, 'active', 'metadata.json'), 'utf8'),
    )

    expect(versionDirEntries.some((entry) => entry.endsWith('.xdb'))).toBe(true)
    expect(activeDirEntries.some((entry) => entry.endsWith('.xdb'))).toBe(true)
    expect(metadata).toEqual(expect.objectContaining({
      originalFileName: 'ip2region_v4.xdb',
      fileSize: Buffer.byteLength('xdb-content'),
    }))
    expect(geoService.reloadFromFile).toHaveBeenCalledWith(
      expect.stringContaining(`${join(dataDir, 'active')}\\`),
      expect.objectContaining({
        source: 'managed-active',
        fileSize: Buffer.byteLength('xdb-content'),
      }),
    )
    expect(result).toEqual(expect.objectContaining({
      ready: true,
      source: 'managed-active',
      reloading: false,
    }))
  })
})
