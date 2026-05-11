import { BusinessException } from '@libs/platform/exceptions'
import axios from 'axios'
import { CopyMangaHttpClient } from './copy-manga-http.client'

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}))

describe('CopyMangaHttpClient', () => {
  const mockedAxiosCreate = jest.mocked(axios.create)
  const getMock = jest.fn()

  function createClient() {
    mockedAxiosCreate.mockReturnValue({ get: getMock } as never)
    return new CopyMangaHttpClient()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getMock.mockReset()
  })

  it('rethrows the same discovery error and does not call content API', async () => {
    const discoveryError = new Error('network down')
    getMock.mockRejectedValueOnce(discoveryError)
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toBe(
      discoveryError,
    )

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed on non-success discovery code before content API request', async () => {
    getMock.mockResolvedValueOnce({
      data: { code: 500, message: 'maintenance' },
    })
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed on malformed discovery api results before content API request', async () => {
    getMock.mockResolvedValueOnce({
      data: { code: 200, results: { api: 'api.copy.test' } },
    })
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed on empty usable discovery hosts before content API request', async () => {
    getMock.mockResolvedValueOnce({
      data: { code: 200, results: { api: [[], ['', null]] } },
    })
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('queries discovered hosts in discovery order after successful refresh', async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          code: 200,
          results: {
            api: [['api-a.copy.test'], ['api-b.copy.test', 'api-a.copy.test']],
          },
        },
      })
      .mockResolvedValueOnce({ data: { code: 200, results: { ok: true } } })
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).resolves.toEqual({
      code: 200,
      results: { ok: true },
    })

    expect(getMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/search/comic',
      expect.any(Object),
    )
  })

  it('only retries hosts from the successful discovery result set', async () => {
    const hostAError = new Error('host a failed')
    getMock
      .mockResolvedValueOnce({
        data: {
          code: 200,
          results: { api: [['api-a.copy.test'], ['api-b.copy.test']] },
        },
      })
      .mockRejectedValueOnce(hostAError)
      .mockResolvedValueOnce({ data: { code: 200, results: { ok: true } } })
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).resolves.toEqual({
      code: 200,
      results: { ok: true },
    })

    expect(getMock).toHaveBeenCalledTimes(3)
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/search/comic',
      expect.any(Object),
    )
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      'https://api-b.copy.test/api/v3/search/comic',
      expect.any(Object),
    )
  })
})
