import { createKeyv } from '@keyv/redis'
import { isDevelopment } from '@libs/base/utils'
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
          const { connection, namespace = 0 } = configService.get('redis')

          const redisUrl = connection

          return {
            ttl: 0,
            namespace,
            stores: isDevelopment()
              ? new Keyv({
                  store: new CacheableMemory({ lruSize: 5000 }),
                })
              : createKeyv(redisUrl, { namespace }),
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
