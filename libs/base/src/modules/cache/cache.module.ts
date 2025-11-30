import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { DynamicModule, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CacheableMemory } from 'cacheable'
import { Keyv } from 'keyv'

@Module({})
export class CustomCacheModule {
  /**
   * 注册缓存模块
   * @returns 动态模块配置
   */
  static register(): DynamicModule {
    const imports = [
      CacheModule.registerAsync({
        isGlobal: true,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const { host, port, password, namespace } = configService.get('redis')

          // 构建 Redis URL
          // 对密码进行URL编码，避免包含特殊字符导致解析错误
          const encodedPassword = password ? encodeURIComponent(password) : ''
          const authPart = encodedPassword ? `:${encodedPassword}@` : ''
          const redisUrl = `redis://${authPart}${host}:${port}`

          return {
            ttl: 0,
            stores: [
              new Keyv({
                store: new KeyvRedis(redisUrl, { namespace }),
                useKeyPrefix: false,
                ttl: 0,
                namespace,
              }),
              new Keyv({
                store: new CacheableMemory({
                  ttl: 0,
                  lruSize: 5000,
                }),
              }),
            ],
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
   * 根模块配置（与register相同，提供兼容性）
   * @returns 动态模块配置
   */
  static forRoot(): DynamicModule {
    return this.register()
  }
}
