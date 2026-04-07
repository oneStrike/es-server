import { Buffer } from 'node:buffer'

const existsSync = jest.fn()
const verifyFromFile = jest.fn()
const loadContentFromFile = jest.fn()
const newWithBuffer = jest.fn()

jest.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => existsSync(...args),
}))

jest.mock('ip2region.js', () => ({
  IPv4: { name: 'IPv4' },
  verifyFromFile: (...args: unknown[]) => verifyFromFile(...args),
  loadContentFromFile: (...args: unknown[]) => loadContentFromFile(...args),
  newWithBuffer: (...args: unknown[]) => newWithBuffer(...args),
}))

describe('geo service', () => {
  const previousDbPath = process.env.IP2REGION_XDB_PATH

  beforeEach(() => {
    process.env.IP2REGION_XDB_PATH = 'D:/fixtures/ip2region_v4.xdb'
    existsSync.mockReset()
    verifyFromFile.mockReset()
    loadContentFromFile.mockReset()
    newWithBuffer.mockReset()
  })

  afterAll(() => {
    if (previousDbPath === undefined) {
      delete process.env.IP2REGION_XDB_PATH
      return
    }

    process.env.IP2REGION_XDB_PATH = previousDbPath
  })

  it('loads the xdb lazily and reuses the searcher across lookups', async () => {
    const search = jest
      .fn()
      .mockReturnValueOnce('中国|0|广东省|深圳市|电信')
      .mockReturnValueOnce('中国|0|上海市|上海市|联通')
    newWithBuffer.mockReturnValue({ search, close: jest.fn() })
    existsSync.mockReturnValue(true)
    loadContentFromFile.mockReturnValue(Buffer.from('xdb'))

    const { GeoService } = await import('../geo.service')
    const service = new GeoService()

    await expect(service.resolveByIp('1.2.3.4')).resolves.toEqual({
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    })
    await expect(service.resolveByIp('2.3.4.5')).resolves.toEqual({
      geoCountry: '中国',
      geoProvince: '上海市',
      geoCity: '上海市',
      geoIsp: '联通',
      geoSource: 'ip2region',
    })

    expect(verifyFromFile).toHaveBeenCalledTimes(1)
    expect(loadContentFromFile).toHaveBeenCalledTimes(1)
    expect(newWithBuffer).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledTimes(2)
  })

  it('returns an empty geo snapshot when the xdb file is missing', async () => {
    existsSync.mockReturnValue(false)

    const { GeoService } = await import('../geo.service')
    const service = new GeoService()

    await expect(service.resolveByIp('1.2.3.4')).resolves.toEqual({
      geoCountry: undefined,
      geoProvince: undefined,
      geoCity: undefined,
      geoIsp: undefined,
      geoSource: 'ip2region',
    })

    expect(verifyFromFile).not.toHaveBeenCalled()
    expect(loadContentFromFile).not.toHaveBeenCalled()
    expect(newWithBuffer).not.toHaveBeenCalled()
  })

  it('degrades to empty geo fields when the searcher throws', async () => {
    existsSync.mockReturnValue(true)
    loadContentFromFile.mockReturnValue(Buffer.from('xdb'))
    newWithBuffer.mockReturnValue({
      search: jest.fn(() => {
        throw new Error('boom')
      }),
      close: jest.fn(),
    })

    const { GeoService } = await import('../geo.service')
    const service = new GeoService()

    await expect(service.resolveByIp('1.2.3.4')).resolves.toEqual({
      geoCountry: undefined,
      geoProvince: undefined,
      geoCity: undefined,
      geoIsp: undefined,
      geoSource: 'ip2region',
    })
  })
})
