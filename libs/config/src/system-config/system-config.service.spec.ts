/// <reference types="jest" />

import type { DrizzleService } from '@db/core'
import type { AesService } from '@libs/platform/modules/crypto/aes.service'
import type { RsaService } from '@libs/platform/modules/crypto/rsa.service'
import type { Cache } from 'cache-manager'
import type { ConfigReader } from './config-reader'
import type { UpdateSystemConfigDto } from './dto/config.dto'
import * as schema from '@db/schema'
import { CACHE_KEY, DEFAULT_CONFIG } from './system-config.constant'
import { SystemConfigService } from './system-config.service'

function createLatestConfigSelect(result: Array<Record<string, unknown>>) {
  const builder = {
    from: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    limit: jest.fn(() => Promise.resolve(result)),
  }
  return builder
}

describe('SystemConfigService security config', () => {
  it('persists security config and refreshes the readable cache snapshot', async () => {
    const persistedSnapshots: Array<Record<string, unknown>> = []
    const latestConfig = {
      id: 1,
      ...DEFAULT_CONFIG,
    }
    const tx = {
      execute: jest.fn(() => Promise.resolve()),
      select: jest.fn(() => createLatestConfigSelect([latestConfig])),
      insert: jest.fn(() => ({
        values: jest.fn((snapshot: Record<string, unknown>) => {
          persistedSnapshots.push(snapshot)
          return {
            returning: jest.fn(() =>
              Promise.resolve([
                {
                  id: 2,
                  ...snapshot,
                },
              ]),
            ),
          }
        }),
      })),
    }
    const aesService: Pick<AesService, 'decrypt' | 'encrypt'> = {
      decrypt: jest.fn(async (value: string) => value),
      encrypt: jest.fn(async (value: string) => value),
    }
    const rsaService: Pick<RsaService, 'decryptWith'> = {
      decryptWith: jest.fn((value: string) => value),
    }
    const drizzle = {
      schema,
      db: tx,
      ext: {},
      withTransaction: jest.fn(
        async <T>(callback: (transaction: typeof tx) => Promise<T>) =>
          callback(tx),
      ),
      withErrorHandling: jest.fn(async <T>(callback: () => Promise<T>) =>
        callback(),
      ),
    }
    const cacheManager: Pick<Cache, 'set'> = {
      set: async <T>(_key: string, value: T) => value,
    }
    const cacheSetSpy = jest.spyOn(cacheManager, 'set')
    const configReader: Pick<ConfigReader, 'refresh'> = {
      refresh: jest.fn(() => Promise.resolve()),
    }
    const service = new SystemConfigService(
      aesService as AesService,
      rsaService as RsaService,
      cacheManager as Cache,
      configReader as ConfigReader,
      drizzle as unknown as DrizzleService,
    )
    const dto: UpdateSystemConfigDto = {
      id: 1,
      securityConfig: {
        remoteImageImport: {
          enableAddressGuard: true,
        },
      },
    }

    await expect(
      service.updateConfig(dto, 7),
    ).resolves.toBe(true)

    expect(persistedSnapshots[0]).toEqual(
      expect.objectContaining({
        securityConfig: {
          remoteImageImport: {
            enableAddressGuard: true,
          },
        },
        updatedById: 7,
      }),
    )
    expect(cacheSetSpy).toHaveBeenCalledWith(
      CACHE_KEY.CONFIG,
      expect.objectContaining({
        securityConfig: {
          remoteImageImport: {
            enableAddressGuard: true,
          },
        },
      }),
      expect.any(Number),
    )
    expect(configReader.refresh).toHaveBeenCalled()
  })
})
