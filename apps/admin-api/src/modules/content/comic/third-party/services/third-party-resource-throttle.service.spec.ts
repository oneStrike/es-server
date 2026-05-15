import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import type { ConfigReader } from '@libs/system-config/config-reader'
import { ThirdPartyResourceThrottleService } from './third-party-resource-throttle.service'

describe('ThirdPartyResourceThrottleService', () => {
  function createService(
    config: ReturnType<ConfigReader['getThirdPartyResourceParseConfig']>,
  ) {
    const configReader = {
      getThirdPartyResourceParseConfig: jest.fn(() => config),
    }

    return {
      configReader,
      service: new ThirdPartyResourceThrottleService(
        configReader as unknown as ConfigReader,
      ),
    }
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-15T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('runs the first API request immediately and delays the next request by apiIntervalMs', async () => {
    const { service } = createService({
      enabled: true,
      apiIntervalMs: 3000,
      imageIntervalMs: 5000,
      hostCacheTtlSeconds: 60,
      maxQueueSize: 10,
    })
    await expect(service.waitForApiSlot()).resolves.toBeUndefined()

    let secondResolved = false
    const second = service.waitForApiSlot().then(() => {
      secondResolved = true
    })
    await Promise.resolve()

    expect(secondResolved).toBe(false)
    await jest.advanceTimersByTimeAsync(2999)
    expect(secondResolved).toBe(false)
    await jest.advanceTimersByTimeAsync(1)
    await second
    expect(secondResolved).toBe(true)
  })

  it('keeps image pacing independent from the API channel', async () => {
    const { service } = createService({
      enabled: true,
      apiIntervalMs: 3000,
      imageIntervalMs: 5000,
      hostCacheTtlSeconds: 60,
      maxQueueSize: 10,
    })

    await expect(service.waitForApiSlot()).resolves.toBeUndefined()
    await expect(service.waitForImageSlot()).resolves.toBeUndefined()
  })

  it('preserves FIFO ordering for queued API requests', async () => {
    const { service } = createService({
      enabled: true,
      apiIntervalMs: 1000,
      imageIntervalMs: 1000,
      hostCacheTtlSeconds: 60,
      maxQueueSize: 10,
    })
    const order: string[] = []

    const first = service.waitForApiSlot().then(() => order.push('first'))
    const second = service.waitForApiSlot().then(() => order.push('second'))
    const third = service.waitForApiSlot().then(() => order.push('third'))

    await first
    expect(order).toEqual(['first'])
    await jest.advanceTimersByTimeAsync(1000)
    await second
    expect(order).toEqual(['first', 'second'])
    await jest.advanceTimersByTimeAsync(1000)
    await third
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('applies maxQueueSize per channel and throws a business error on overflow', async () => {
    const { service } = createService({
      enabled: true,
      apiIntervalMs: 1000,
      imageIntervalMs: 1000,
      hostCacheTtlSeconds: 60,
      maxQueueSize: 1,
    })

    const firstApi = service.waitForApiSlot()
    await expect(service.waitForApiSlot()).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '三方资源解析请求排队过多，请稍后重试',
    })
    await expect(service.waitForImageSlot()).resolves.toBeUndefined()
    await firstApi
  })

  it('bypasses waiting and queue overflow checks when disabled', async () => {
    const { service } = createService({
      enabled: false,
      apiIntervalMs: 3000,
      imageIntervalMs: 3000,
      hostCacheTtlSeconds: 60,
      maxQueueSize: 0,
    })

    await expect(
      Promise.all([
        service.waitForApiSlot(),
        service.waitForApiSlot(),
        service.waitForImageSlot(),
        service.waitForImageSlot(),
      ]),
    ).resolves.toEqual([undefined, undefined, undefined, undefined])
  })

  it('exposes host cache TTL in milliseconds from normalized config', () => {
    const { service } = createService({
      enabled: true,
      apiIntervalMs: 3000,
      imageIntervalMs: 3000,
      hostCacheTtlSeconds: 90,
      maxQueueSize: 1000,
    })

    expect(service.getHostCacheTtlMs()).toBe(90_000)
  })

  it('throws BusinessException instances for overflow failures', async () => {
    const { service } = createService({
      enabled: true,
      apiIntervalMs: 1000,
      imageIntervalMs: 1000,
      hostCacheTtlSeconds: 60,
      maxQueueSize: 1,
    })

    void service.waitForApiSlot()

    await expect(service.waitForApiSlot()).rejects.toThrow(BusinessException)
  })
})
