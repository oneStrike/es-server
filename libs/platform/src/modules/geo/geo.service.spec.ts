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

  afterEach(async () => {
    process.env.IP2REGION_DATA_DIR = previousDataDir
    delete process.env.IP2REGION_XDB_PATH
    jest.clearAllMocks()
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
})
