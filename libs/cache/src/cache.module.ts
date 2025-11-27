import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CacheableMemory } from 'cacheable'
import { Keyv } from 'keyv'
import { CacheModuleConfig } from './types'

@Module({})
export class CustomCacheModule {
  /**
   * 注册缓存模块
   * @param options 缓存配置选项
   * @returns 动态模块配置
   */
  static register(options?: CacheModuleConfig): DynamicModule {
    const defaultConfig: CacheModuleConfig = {
      ttl: 0,
      store: ['redis', 'memory'],
    }

    const config = { ...defaultConfig, ...options }

    // 验证配置
    this.validateConfig(config)

    // 提取默认存储和备用存储
    const defaultStore = config.store![0]
    const backupStore = config.store![1]

    const imports = [
      CacheModule.registerAsync({
        isGlobal: true,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const { host, port, password, namespace } = configService.get('redis')
          console.log(
            `🚀 ~ CustomCacheModule ~ register ~ { host, port, password, namespace }:`,
            { host, port, password, namespace },
          )

          // 构建 Redis URL
          // 对密码进行URL编码，避免包含特殊字符导致解析错误
          const encodedPassword = password ? encodeURIComponent(password) : ''
          const authPart = encodedPassword ? `:${encodedPassword}@` : ''
          const redisUrl = `redis://${authPart}${host}:${port}`
          console.log('🚀 ~ CustomCacheModule ~ register ~ redisUrl:', redisUrl)

          return {
            ttl: config.ttl,
            stores: [
              // 创建默认存储
              this.createStore(defaultStore, redisUrl, namespace, config.ttl!),
              // 创建备用存储（如果有）
              backupStore
                ? this.createStore(
                    backupStore,
                    redisUrl,
                    namespace,
                    config.ttl!,
                  )
                : null,
            ].filter(
              (store): store is NonNullable<typeof store> => store !== null,
            ),
          }
        },
      }),
    ]

    return {
      module: CustomCacheModule,
      imports,
      exports: imports,
    }
  }

  /**
   * 验证缓存模块配置
   * @param config 缓存配置
   * @throws Error 配置验证失败时抛出错误
   */
  private static validateConfig(config: CacheModuleConfig): void {
    if (!config.store || config.store.length === 0) {
      throw new Error('CustomCacheModule：请配置缓存存储类型')
    }

    // 验证存储类型的有效性
    const validStoreTypes = ['redis', 'memory']
    for (const storeType of config.store) {
      if (!validStoreTypes.includes(storeType)) {
        throw new Error(`CustomCacheModule：不支持的缓存存储类型: ${storeType}`)
      }
    }

    // 验证TTL值的有效性
    if (
      config.ttl !== undefined &&
      (typeof config.ttl !== 'number' || config.ttl < 0)
    ) {
      throw new Error('CustomCacheModule：TTL必须是非负数字')
    }
  }

  /**
   * 创建缓存存储实例
   * @param storeType 存储类型
   * @param redisUrl Redis连接URL
   * @param namespace 命名空间
   * @param ttl 过期时间
   * @returns 缓存存储实例
   */
  private static createStore(
    storeType: 'redis' | 'memory',
    redisUrl: string,
    namespace: string,
    ttl: number,
  ): any {
    if (storeType === 'redis') {
      return new KeyvRedis(redisUrl, { namespace })
    } else if (storeType === 'memory') {
      return new Keyv({
        store: new CacheableMemory({
          ttl,
          lruSize: 5000,
        }),
      })
    }

    return null
  }

  /**
   * 根模块配置（与register相同，提供兼容性）
   * @param options 缓存配置选项
   * @returns 动态模块配置
   */
  static forRoot(options?: CacheModuleConfig): DynamicModule {
    return this.register(options)
  }
}
