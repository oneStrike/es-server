import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import type { ThirdPartyResourceThrottleService } from '../services/third-party-resource-throttle.service'
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

  function createClient(
    throttle: Partial<ThirdPartyResourceThrottleService> = {},
  ) {
    return new CopyMangaHttpClient({
      getHostCacheTtlMs: jest.fn(() => 60_000),
      waitForApiSlot: jest.fn(async () => undefined),
      ...throttle,
    } as ThirdPartyResourceThrottleService)
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

  it('reuses discovered hosts while the TTL cache is valid', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { first: true } }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { second: true } }),
      )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).resolves.toEqual({
      code: 200,
      results: { first: true },
    })
    await expect(client.getJson('/api/v3/comic/demo')).resolves.toEqual({
      code: 200,
      results: { second: true },
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api-a.copy.test/api/v3/comic/demo?platform=3',
      expect.any(Object),
    )
  })

  it('refreshes host discovery after the TTL cache expires', async () => {
    let now = 1_000
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { first: true } }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-b.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { second: true } }),
      )
    const client = createClient({
      getHostCacheTtlMs: jest.fn(() => 60_000),
    })

    try {
      await client.getJson('/api/v3/search/comic')
      now += 60_001
      await client.getJson('/api/v3/comic/demo')
    } finally {
      dateSpy.mockRestore()
    }

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://api-b.copy.test/api/v3/comic/demo?platform=3',
      expect.any(Object),
    )
  })

  it('paces both discovery and business JSON requests through the API limiter', async () => {
    const throttle = {
      getHostCacheTtlMs: jest.fn(() => 60_000),
      waitForApiSlot: jest.fn(async () => undefined),
    }
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
    const client = createClient(throttle)

    await client.getJson('/api/v3/search/comic')

    expect(throttle.waitForApiSlot).toHaveBeenCalledTimes(2)
  })

  it('does not retry when the API limiter rejects a queued request', async () => {
    const throttleError = new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '排队过多',
    )
    let waitCallCount = 0
    const throttle = {
      getHostCacheTtlMs: jest.fn(() => 60_000),
      waitForApiSlot: jest.fn(async () => {
        waitCallCount += 1
        if (waitCallCount > 1) {
          throw throttleError
        }
      }),
    }
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        code: 200,
        results: { api: [['api-a.copy.test']] },
      }),
    )
    const client = createClient(throttle)

    await expect(client.getJson('/api/v3/search/comic')).rejects.toBe(
      throttleError,
    )

    expect(throttle.waitForApiSlot).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not reuse stale hosts when expired-cache discovery fails', async () => {
    let now = 1_000
    const dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now)
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { first: true } }),
      )
      .mockRejectedValue(new Error('discovery down'))
    const client = createClient({
      getHostCacheTtlMs: jest.fn(() => 60_000),
    })

    try {
      await client.getJson('/api/v3/search/comic')
      now += 60_001
      await expect(client.getJson('/api/v3/comic/demo')).rejects.toThrow(
        BusinessException,
      )
    } finally {
      dateSpy.mockRestore()
    }

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://api-a.copy.test/api/v3/comic/demo?platform=3',
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

  it('preserves structured HTTP status and path on exhausted content API failures', async () => {
    const path = '/api/v3/comic/demo/chapter/demo'
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockResolvedValue(
        createJsonResponse({ message: 'missing' }, { status: 404 }),
      )
    const client = createClient()

    await expect(client.getJson(path)).rejects.toMatchObject({
      cause: {
        kind: 'http',
        path,
        reason: 'HTTP 404',
        routeCandidateRecoverable: true,
        status: 404,
      },
      message: `CopyManga API 请求失败：HTTP 404 (${path})`,
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('marks statusless socket failures on chapter content routes as recoverable route-candidate failures', async () => {
    const path = '/api/v3/comic/demo/chapter3/demo'
    const socketError = Object.assign(
      new TypeError('The socket connection was closed unexpectedly'),
      {
        cause: { code: 'UND_ERR_SOCKET' },
      },
    )
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockRejectedValue(socketError)
    const client = createClient()

    await expect(client.getJson(path)).rejects.toMatchObject({
      cause: {
        code: 'UND_ERR_SOCKET',
        kind: 'transport',
        path,
        reason: 'The socket connection was closed unexpectedly',
        routeCandidateRecoverable: true,
      },
    })
  })

  it('invalidates cached hosts after content retries are exhausted', async () => {
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-a.copy.test']] },
        }),
      )
      .mockRejectedValueOnce(new Error('host a failed'))
      .mockRejectedValueOnce(new Error('host a failed'))
      .mockRejectedValueOnce(new Error('host a failed'))
      .mockResolvedValueOnce(
        createJsonResponse({
          code: 200,
          results: { api: [['api-b.copy.test']] },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ code: 200, results: { ok: true } }),
      )
    const client = createClient()

    await expect(client.getJson('/api/v3/search/comic')).rejects.toThrow(
      BusinessException,
    )
    await expect(client.getJson('/api/v3/comic/demo')).resolves.toEqual({
      code: 200,
      results: { ok: true },
    })

    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://api.2024manga.com/api/v3/system/network2?platform=3',
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
