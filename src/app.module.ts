import * as process from 'node:process'
import KeyvRedis from '@keyv/redis'
import { CacheModule } from '@nestjs/cache-manager'
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { CacheableMemory } from 'cacheable'
import { Keyv } from 'keyv'
import { CustomPrismaModule } from 'nestjs-prisma/dist/custom'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'
import { LoggerInterceptor } from '@/common/interceptors/logger.interceptor'
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor'
import { CryptoModule } from '@/common/module/crypto/crypto.module'
import { LoggerModule } from '@/common/module/logger/logger.module'
import uploadConfig from '@/config/upload.config'
import { AdminModule } from '@/modules/admin/admin.module'
import { ClientModule } from '@/modules/client/client.module'
import { HealthModule } from '@/modules/foundation/health/health.module'
import { PrismaService } from '@/prisma/prisma.connect'
import { JwtAuthGuard } from './common/guards/auth.guard'

// 缓存配置工厂函数
function createCacheConfig(config: ConfigService) {
  const host = config.get<string>('REDIS_HOST') || 'localhost'
  const port = (config.get<string>('REDIS_PORT') || '6379').toString()
  const password = config.get<string>('REDIS_PASSWORD') || ''
  const namespace = config.get<string>('REDIS_NAMESPACE') || 'Akaiito'

  // 对密码进行 URL 编码，避免包含特殊字符导致解析错误
  const encodedPassword = password ? encodeURIComponent(password) : ''
  const authPart = encodedPassword ? `:${encodedPassword}@` : ''
  const url = `redis://${authPart}${host}:${port}`

  return {
    ttl: 5 * 60 * 1000, // 默认TTL：5分钟，单位毫秒
    stores: [
      // 使用 Keyv 的 Redis 适配器作为缓存存储
      new KeyvRedis(url, { namespace }),
      new Keyv({
        store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
      }),
    ],
  }
}

@Module({
  imports: [
    // 配置模块 - 全局环境变量管理
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`], // 指定环境变量文件路径
      load: [uploadConfig], // 加载上传配置
      cache: true, // 缓存配置
    }),

    // 数据库模块 - Prisma ORM 配置
    CustomPrismaModule.forRootAsync({
      isGlobal: true,
      name: 'PrismaService',
      useClass: PrismaService,
    }),

    // 缓存模块 - Redis 和内存缓存配置
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createCacheConfig,
    }),

    // 限流模块 - 防止 API 滥用
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 }, // 短时间限流：1秒最多10次请求
      { name: 'medium', ttl: 10000, limit: 30 }, // 中等时间限流：10秒最多30次请求
      { name: 'long', ttl: 60000, limit: 100 }, // 长时间限流：1分钟最多100次请求
    ]),

    // 基础功能模块
    LoggerModule, // 日志模块
    CryptoModule, // 加密模块

    // 业务功能模块
    AdminModule, // 管理模块
    ClientModule, // 客户端模块
    HealthModule, // 健康检查模块
  ],

  controllers: [],

  providers: [
    // 全局验证管道 - 数据格式校验
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true, // 自动转换请求数据类型
        whitelist: true, // 过滤掉未在 DTO 中定义的属性
        exceptionFactory: (errors) => new BadRequestException(
          errors.map((error) => {
            const errorMsg: string[] = []
            if (error.constraints) {
              errorMsg.push(...Object.values(error.constraints))
            }
            return `${error.property}${errorMsg.join('，')}`
          }),
        )
      }),
    },

    // 全局拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor, // 日志拦截器（最先执行）
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor, // 响应转换拦截器
    },

    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // 全局守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // 限流守卫
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // JWT 认证守卫
    },
  ],
})
export class AppModule {}
