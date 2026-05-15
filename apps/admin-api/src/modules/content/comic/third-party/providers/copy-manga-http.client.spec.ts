import { BusinessException } from '@libs/platform/exceptions'
import { CopyMangaHttpClient } from './copy-manga-http.client'

describe('CopyMangaHttpClient', () => {
  const fetchMock = jest.fn()

  // 构造 CopyManga JSON 响应，测试关注业务 payload 与 HTTP 状态语义。
  function createJsonResponse(
    data: unknown,
    init: { status?: number; statusText?: string } = {},
  ): Response {
    const status = init.status ?? 200
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: init.statusText ?? 'OK',
      json: jest.fn(async () => data),
      text: jest.fn(async () => JSON.stringify(data)),
    } as unknown as Response
  }

  // 构造 JSON 解析失败响应，锁定 fetch 替换后的错误归类。
  function createInvalidJsonResponse(): Response {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn(async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      }),
      text: jest.fn(async () => '<html>not json</html>'),
    } as unknown as Response
  }

  function createClient() {
    return new CopyMangaHttpClient()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as never
  })

  it('uses a five minute timeout for CopyManga requests', async () => {
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout')
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { ok: true } }),
      )
    const client = createClient()

    try {
      await expect(client.getJson('/api/v3/search/comic')).resolves.toEqual({
        code: 200,
        results: { ok: true },
      })
      expect(timeoutSpy).toHaveBeenCalledWith(300000)
    } finally {
      timeoutSpy.mockRestore()
    }
  })

  it('classifies discovery request failures after three attempts', async () => {
    const discoveryError = new Error('network down')
    fetchMock.mockRejectedValue(discoveryError)
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('classifies discovery timeout failures after three attempts', async () => {
    const timeoutError = Object.assign(new Error('signal timed out'), {
      name: 'TimeoutError',
    })
    fetchMock.mockRejectedValue(timeoutError)
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('classifies malformed discovery JSON after three attempts', async () => {
    fetchMock.mockResolvedValue(createInvalidJsonResponse())
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries non-success discovery code before failing closed', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({ code: 500, message: 'maintenance' }),
    )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('fails closed on malformed discovery api results before content API request', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ code: 200, results: { api: 'api.copy.test' } }),
    )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed on empty usable discovery hosts before content API request', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ code: 200, results: { api: [[], ['', null]] } }),
    )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('queries discovered hosts in discovery order after successful refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: {
            api: [['api-a.copy.test'], ['api-b.copy.test', 'api-a.copy.test']],
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { ok: true } }),
      )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).resolves.toEqual({
      code: 200,
      results: { ok: true },
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
  })

  it('preserves provided params and appends the platform query param', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { ok: true } }),
      )
    const client = createClient()

    await client.getJson('/api/v3/search/comic', {
      keyword: 'demo comic',
      offset: 20,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/search/comic?keyword=demo+comic&offset=20&platform=3',
      expect.any(Object),
    )
  })

  it('only retries hosts from the successful discovery result set', async () => {
    const hostAError = new Error('host a failed')
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test'], ['api-b.copy.test']] },
        }),
      )
      .mockRejectedValueOnce(hostAError)
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { ok: true } }),
      )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).resolves.toEqual({
      code: 200,
      results: { ok: true },
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api-b.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
  })

  it('classifies exhausted content API failures after three attempts', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockRejectedValue(new Error('404 upstream'))
    const client = createClient()

    await expect(
      client.getJson('/api/v3/comic/demo/chapter/demo'),
    ).rejects.toThrow(BusinessException)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/comic/demo/chapter/demo?platform=3',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api-a.copy.test/api/v3/comic/demo/chapter/demo?platform=3',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://api-a.copy.test/api/v3/comic/demo/chapter/demo?platform=3',
      expect.any(Object),
    )
  })

  it('classifies malformed content JSON after exhausting discovered hosts', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValue(createInvalidJsonResponse())
    const client = createClient()

    await expect(
      client.getJson('/api/v3/comic/demo/chapter/demo'),
    ).rejects.toThrow(BusinessException)

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('keeps the fixed content retry budget when discovery returns extra hosts', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: {
            api: [
              ['api-a.copy.test'],
              ['api-b.copy.test'],
              ['api-c.copy.test'],
              ['api-d.copy.test'],
            ],
          },
        }),
      )
      .mockRejectedValueOnce(new Error('host a timeout'))
      .mockRejectedValueOnce(new Error('host b timeout'))
      .mockRejectedValueOnce(new Error('host c timeout'))
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-a.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api-b.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://api-c.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://api-d.copy.test/api/v3/search/comic?platform=3',
      expect.any(Object),
    )
  })
})
