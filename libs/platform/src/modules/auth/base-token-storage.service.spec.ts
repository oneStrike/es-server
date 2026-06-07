import type { ITokenEntity } from './token-storage.type'
import { BaseTokenStorageService } from './base-token-storage.service'

class TestTokenStorageService extends BaseTokenStorageService<ITokenEntity> {
  token: ITokenEntity | null = null

  protected async createOne() {
    return this.token as ITokenEntity
  }

  protected async createManyItems() {
    return 0
  }

  protected async findOneByJti() {
    return this.token
  }

  protected async updateManyItems() {
    return 0
  }

  protected async findManyItems() {
    return []
  }

  protected async deleteManyItems() {
    return 0
  }
}

function createToken(overrides: Partial<ITokenEntity>): ITokenEntity {
  const now = new Date()
  return {
    id: 1,
    jti: 'token-jti',
    userId: 1,
    tokenType: 1,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    revokeReason: null,
    deviceInfo: null,
    ipAddress: null,
    userAgent: null,
    geoCountry: null,
    geoProvince: null,
    geoCity: null,
    geoIsp: null,
    geoSource: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createMemoryCache() {
  const store = new Map<string, unknown>()
  return {
    cache: {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value)
      }),
    },
    store,
  }
}

describe('BaseTokenStorageService validation cache safety', () => {
  it('does not trust a stale valid cache marker after database revocation', async () => {
    const { cache, store } = createMemoryCache()
    const service = new TestTokenStorageService(cache as never)
    service.token = createToken({
      jti: 'token-jti',
      revokedAt: new Date(),
    })
    store.set('token:token-jti', 'valid')

    await expect(service.isTokenValid('token-jti')).resolves.toBe(false)
    expect(cache.set).toHaveBeenCalledWith(
      'token:token-jti',
      'invalid',
      expect.any(Number),
    )
  })

  it('still rejects directly from invalid cache markers', async () => {
    const { cache, store } = createMemoryCache()
    const service = new TestTokenStorageService(cache as never)
    const findSpy = jest.spyOn(service, 'findByJti')
    store.set('token:token-jti', 'invalid')

    await expect(service.isTokenValid('token-jti')).resolves.toBe(false)
    expect(findSpy).not.toHaveBeenCalled()
  })
})
