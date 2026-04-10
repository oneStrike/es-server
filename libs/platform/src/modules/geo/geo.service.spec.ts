import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GeoService } from './geo.service'

const closeSearcherA = jest.fn()
const verifyFromFileMock = jest.fn()
const loadContentFromFileMock = jest.fn((dbPath: string) => `buffer:${dbPath}`)
const newWithBufferMock = jest.fn()

jest.mock('ip2region.js', () => ({
  IPv4: 'IPv4',
  loadContentFromFile: (dbPath: string) => loadContentFromFileMock(dbPath),
  newWithBuffer: (...args: unknown[]) => newWithBufferMock(...args),
  verifyFromFile: (dbPath: string) => verifyFromFileMock(dbPath),
}))

describe('geoService', () => {
  const previousDataDir = process.env.IP2REGION_DATA_DIR
  const previousCwd = process.cwd()

  afterEach(async () => {
    process.env.IP2REGION_DATA_DIR = previousDataDir
    delete process.env.IP2REGION_XDB_PATH
    process.chdir(previousCwd)
    jest.clearAllMocks()
  })

  it('未配置 IP2REGION_DATA_DIR 时仍会从默认托管目录恢复 active 库', async () => {
    const workspaceDir = await mkdtemp(join(tmpdir(), 'geo-default-storage-'))
    const activeDir = join(workspaceDir, 'uploads', 'ip2region', 'active')
    const activeFileName = '20260409-120000-ip2region_v4.xdb'
    const activeFilePath = join(activeDir, activeFileName)
    const activatedAt = '2026-04-09T12:00:00.000Z'

    delete process.env.IP2REGION_DATA_DIR
    process.chdir(workspaceDir)

    await mkdir(activeDir, { recursive: true })
    await writeFile(activeFilePath, 'test')
    await writeFile(
      join(activeDir, 'metadata.json'),
      JSON.stringify({
        activeFileName,
        originalFileName: 'ip2region_v4.xdb',
        activatedAt,
        fileSize: 4,
      }),
    )

    const service = new GeoService()

    await expect(service.getRuntimeStatus()).resolves.toMatchObject({
      ready: true,
      source: 'managed-active',
      fileName: activeFileName,
      filePath: activeFilePath,
      fileSize: 4,
      storageDir: join(workspaceDir, 'uploads', 'ip2region'),
    })

    process.chdir(previousCwd)
    await rm(workspaceDir, { recursive: true, force: true })
  })

  it('状态查询会优先识别 active 目录中的当前生效库', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'geo-status-'))
    const activeDir = join(dataDir, 'active')
    const activeFileName = '20260408-120000-ip2region_v4.xdb'
    const activeFilePath = join(activeDir, activeFileName)
    const activatedAt = '2026-04-08T12:00:00.000Z'

    process.env.IP2REGION_DATA_DIR = dataDir

    await mkdir(activeDir, { recursive: true })
    await writeFile(activeFilePath, 'test')
    await writeFile(
      join(activeDir, 'metadata.json'),
      JSON.stringify({
        activeFileName,
        originalFileName: 'ip2region_v4.xdb',
        activatedAt,
        fileSize: 4,
      }),
    )

    const service = new GeoService()

    const status = await service.getRuntimeStatus()

    expect(status).toMatchObject({
      ready: true,
      source: 'managed-active',
      fileName: activeFileName,
      filePath: activeFilePath,
      fileSize: 4,
    })
    expect(status.activatedAt?.toISOString()).toBe(activatedAt)

    await rm(dataDir, { recursive: true, force: true })
  })

  it('热切换失败时会保留当前在线查询器', async () => {
    newWithBufferMock
      .mockReturnValueOnce({
        search: jest.fn(),
        close: closeSearcherA,
      })
      .mockImplementationOnce(() => {
        throw new Error('broken xdb')
      })

    const service = new GeoService()

    await service.reloadFromFile('D:/geo/first.xdb', {
      source: 'managed-active',
      fileName: 'first.xdb',
      fileSize: 10,
      activatedAt: new Date('2026-04-08T10:00:00.000Z'),
    })

    await expect(service.reloadFromFile('D:/geo/broken.xdb', {
      source: 'managed-active',
      fileName: 'broken.xdb',
      fileSize: 11,
      activatedAt: new Date('2026-04-08T11:00:00.000Z'),
    })).rejects.toThrow('broken xdb')

    const status = await service.getRuntimeStatus()

    expect(status).toMatchObject({
      fileName: 'first.xdb',
      filePath: 'D:/geo/first.xdb',
    })
    expect(closeSearcherA).not.toHaveBeenCalled()
  })

  it('resolveByIp 会等待异步查询结果并映射为统一属地字段', async () => {
    newWithBufferMock.mockReturnValue({
      search: jest.fn().mockResolvedValue('中国|广东省|深圳市|电信|CN'),
      close: jest.fn(),
    })

    const service = new GeoService()

    await service.reloadFromFile('D:/geo/active.xdb', {
      source: 'managed-active',
      fileName: 'active.xdb',
      fileSize: 12,
      activatedAt: new Date('2026-04-08T12:00:00.000Z'),
    })

    await expect(service.resolveByIp('113.118.113.77')).resolves.toEqual({
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    })
  })
})
