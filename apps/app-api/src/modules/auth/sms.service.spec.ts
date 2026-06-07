import type { Cache } from 'cache-manager'
import { SmsTemplateCodeEnum } from '@libs/platform/modules/sms/sms.constant'
import { appUser } from '@db/schema'
import { HttpException, HttpStatus } from '@nestjs/common'
import { SmsService } from './sms.service'

function createMemoryCache(stores?: unknown[]) {
  const store = new Map<string, unknown>()
  const cache = {
    get: jest.fn(async <T>(key: string) => store.get(key) as T | undefined),
    set: jest.fn(async <T>(key: string, value: T) => {
      store.set(key, value)
      return value
    }),
    del: jest.fn(async (key: string) => {
      return store.delete(key)
    }),
    stores,
  } as unknown as Cache

  return { cache, store }
}

async function expectRateLimited(promise: Promise<unknown>) {
  try {
    await promise
    throw new Error('Expected request to be rate limited')
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }
}

function createService(config: unknown = {}) {
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => []),
        })),
      })),
    })),
  }
  const libSmsService = { sendVerifyCode: jest.fn(async () => true) }
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'app') {
        return config
      }
      if (key === 'app.auth.smsRateLimit') {
        return (config as { auth?: { smsRateLimit?: unknown } })?.auth
          ?.smsRateLimit
      }
      return undefined
    }),
  }
  const { cache, store } = createMemoryCache()
  const service = new SmsService(
    { db, schema: { appUser } } as never,
    libSmsService as never,
    configService as never,
    cache as Cache,
  )

  return { service, libSmsService, store }
}

function createRedisBackedService(config: unknown, redisStore: unknown) {
  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(async () => []),
        })),
      })),
    })),
  }
  const libSmsService = { sendVerifyCode: jest.fn(async () => true) }
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'app') {
        return config
      }
      if (key === 'app.auth.smsRateLimit') {
        return (config as { auth?: { smsRateLimit?: unknown } })?.auth
          ?.smsRateLimit
      }
      return undefined
    }),
  }
  const { cache } = createMemoryCache([{ store: redisStore }])
  const service = new SmsService(
    { db, schema: { appUser } } as never,
    libSmsService as never,
    configService as never,
    cache as Cache,
  )

  return { service, libSmsService }
}

function createRedisStore() {
  const store = new Map<string, { expiresAt?: number, value: number | string }>()
  const client = {
    expire: jest.fn(async (key: string, seconds: number) => {
      const current = store.get(key)
      if (current) {
        current.expiresAt = Date.now() + seconds * 1000
      }
      return 1
    }),
    incr: jest.fn(async (key: string) => {
      const current = Number(store.get(key)?.value ?? 0) + 1
      store.set(key, { value: current })
      return current
    }),
    set: jest.fn(
      async (
        key: string,
        value: string,
        options?: { NX?: boolean, PX?: number },
      ) => {
        if (options?.NX && store.has(key)) {
          return null
        }
        store.set(key, {
          expiresAt: options?.PX ? Date.now() + options.PX : undefined,
          value,
        })
        return 'OK'
      },
    ),
  }

  return {
    client,
    keyPrefixSeparator: '::',
    namespace: 'cache',
    store,
  }
}

describe('SmsService app auth rate limits', () => {
  it('rejects a repeated phone/template send during the default cooldown window', async () => {
    const { service, libSmsService } = createService()
    const dto = {
      phone: '13800000000',
      templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
    }

    await service.sendVerifyCode(dto, '198.51.100.1')

    await expectRateLimited(service.sendVerifyCode(dto, '198.51.100.1'))
    expect(libSmsService.sendVerifyCode).toHaveBeenCalledTimes(1)
  })

  it('serializes same-scope concurrent sends before checking counters', async () => {
    const { service, libSmsService } = createService()
    const dto = {
      phone: '13800000000',
      templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
    }

    const results = await Promise.allSettled([
      service.sendVerifyCode(dto, '198.51.100.1'),
      service.sendVerifyCode(dto, '198.51.100.1'),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    )
    expect(libSmsService.sendVerifyCode).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent sends that share the IP/template counter', async () => {
    const { service, libSmsService } = createService({
      auth: {
        smsRateLimit: {
          phoneTemplateCooldownSeconds: 60,
          phoneTemplateDailyLimit: 10,
          ipTemplateMinuteLimit: 1,
          phoneIpHourLimit: 10,
        },
      },
    })

    const results = await Promise.allSettled([
      service.sendVerifyCode(
        {
          phone: '13800000000',
          templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
        },
        '198.51.100.1',
      ),
      service.sendVerifyCode(
        {
          phone: '13900000000',
          templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
        },
        '198.51.100.1',
      ),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    )
    expect(libSmsService.sendVerifyCode).toHaveBeenCalledTimes(1)
  })

  it('serializes concurrent sends that share the phone/template counter', async () => {
    const { service, libSmsService } = createService({
      auth: {
        smsRateLimit: {
          phoneTemplateCooldownSeconds: 60,
          phoneTemplateDailyLimit: 1,
          ipTemplateMinuteLimit: 10,
          phoneIpHourLimit: 10,
        },
      },
    })

    const results = await Promise.allSettled([
      service.sendVerifyCode(
        {
          phone: '13800000000',
          templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
        },
        '198.51.100.1',
      ),
      service.sendVerifyCode(
        {
          phone: '13800000000',
          templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
        },
        '198.51.100.2',
      ),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    )
    expect(libSmsService.sendVerifyCode).toHaveBeenCalledTimes(1)
  })

  it('uses Redis atomic counters across service instances', async () => {
    const redisStore = createRedisStore()
    const config = {
      auth: {
        smsRateLimit: {
          phoneTemplateCooldownSeconds: 60,
          phoneTemplateDailyLimit: 10,
          ipTemplateMinuteLimit: 1,
          phoneIpHourLimit: 10,
        },
      },
    }
    const first = createRedisBackedService(config, redisStore)
    const second = createRedisBackedService(config, redisStore)

    const results = await Promise.allSettled([
      first.service.sendVerifyCode(
        {
          phone: '13800000000',
          templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
        },
        '198.51.100.1',
      ),
      second.service.sendVerifyCode(
        {
          phone: '13900000000',
          templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
        },
        '198.51.100.1',
      ),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    )
    expect(first.libSmsService.sendVerifyCode).toHaveBeenCalledTimes(1)
    expect(second.libSmsService.sendVerifyCode).toHaveBeenCalledTimes(0)
    expect(redisStore.client.incr).toHaveBeenCalledWith(
      expect.stringContaining('ip-template'),
    )
  })

  it('uses app.auth.smsRateLimit overrides for phone and IP counters', async () => {
    const { service, store } = createService({
      auth: {
        smsRateLimit: {
          phoneTemplateCooldownSeconds: 60,
          phoneTemplateDailyLimit: 2,
          ipTemplateMinuteLimit: 2,
          phoneIpHourLimit: 2,
        },
      },
    })
    const dto = {
      phone: '13800000000',
      templateCode: SmsTemplateCodeEnum.LOGIN_REGISTER,
    }

    await service.sendVerifyCode(dto, '198.51.100.1')
    for (const key of store.keys()) {
      if (key.includes(':cooldown')) {
        store.delete(key)
      }
    }
    await service.sendVerifyCode(dto, '198.51.100.1')
    for (const key of store.keys()) {
      if (key.includes(':cooldown')) {
        store.delete(key)
      }
    }

    await expectRateLimited(service.sendVerifyCode(dto, '198.51.100.1'))
  })
})
