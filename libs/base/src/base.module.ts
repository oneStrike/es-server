import type { Provider } from '@nestjs/common/interfaces/modules/provider.interface'

import type { Type } from '@nestjs/common/interfaces/type.interface'
import { CustomPrismaModule, PrismaService } from '@libs/base/database'
import { LoggerModule } from '@libs/base/modules/logger'
import {
  BadRequestException,
  DynamicModule,
  Module,
  ValidationPipe,
} from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { TransformInterceptor } from './interceptors'
import { CustomCacheModule } from './modules/cache'
import { HealthModule } from './modules/health'

// 定义 BaseModule 可接受的配置接口
export interface BaseModuleOptions {
  // 是否启用日志模块
  enableLogger?: boolean
  // 是否启用数据库模块
  enableDatabase?: boolean
  // 是否启用缓存模块
  enableCache?: boolean
  // 是否启用限流模块
  enableThrottler?: boolean
  // 是否启用健康检查模块
  enableHealth?: boolean
  // 是否启用全局验证管道
  enableGlobalValidationPipe?: boolean
  // 是否启用全局响应转换拦截器
  enableGlobalTransformInterceptor?: boolean
}

@Module({})
export class BaseModule {
  // 静态方法，用于注册模块并传递配置参数
  static register(options: BaseModuleOptions = {}): DynamicModule {
    // 默认配置
    const defaultOptions = {
      enableLogger: true,
      enableDatabase: true,
      enableCache: true,
      enableThrottler: true,
      enableHealth: true,
      enableGlobalValidationPipe: true,
      enableGlobalTransformInterceptor: true,
    }

    // 合并用户配置和默认配置
    const mergedOptions = { ...defaultOptions, ...options }

    // 构建导入模块列表
    const imports: (DynamicModule | Type<any>)[] = []

    // 全局验证管道 - 数据格式校验
    const providers: Provider[] = []

    // 日志模块
    if (mergedOptions.enableLogger) {
      imports.push(LoggerModule)
    }

    // 数据库模块
    if (mergedOptions.enableDatabase) {
      imports.push(
        CustomPrismaModule.forRootAsync({
          isGlobal: true,
          name: 'PrismaService',
          useClass: PrismaService,
        }),
      )
    }

    // 缓存模块
    if (mergedOptions.enableCache) {
      imports.push(CustomCacheModule.forRoot())
    }

    // 限流模块
    if (mergedOptions.enableThrottler) {
      imports.push(
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 10 }, // 短时间限流：1秒最多10次请求
          { name: 'medium', ttl: 10000, limit: 30 }, // 中等时间限流：10秒最多30次请求
          { name: 'long', ttl: 60000, limit: 100 }, // 长时间限流：1分钟最多100次请求
        ]),
      )
      providers.push({
        provide: APP_GUARD,
        useClass: ThrottlerGuard, // 限流守卫
      })
    }

    // 健康检查模块
    if (mergedOptions.enableHealth) {
      imports.push(HealthModule)
    }

    // 全局响应转换拦截器
    if (mergedOptions.enableGlobalTransformInterceptor) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TransformInterceptor, // 响应转换拦截器
      })
    }

    // 全局验证管道
    if (mergedOptions.enableGlobalValidationPipe) {
      providers.push({
        provide: APP_PIPE,
        useValue: new ValidationPipe({
          transform: true, // 自动转换请求数据类型
          whitelist: true, // 过滤掉未在 DTO 中定义的属性
          exceptionFactory: (errors) =>
            new BadRequestException(
              errors
                .map((error) => {
                  const errorMsg: string[] = []
                  if (error.constraints) {
                    errorMsg.push(...Object.values(error.constraints))
                  }
                  return `${error.property}${errorMsg.join('，')}`
                })
                .join(','),
            ),
        }),
      })
    }

    return {
      module: BaseModule,
      imports,
      providers,
      exports: imports, // 导出所有导入的模块
    }
  }

  // 提供默认的 forRoot 方法，方便简单使用
  static forRoot(options?: BaseModuleOptions): DynamicModule {
    return this.register(options)
  }
}
