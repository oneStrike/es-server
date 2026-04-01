import type { Provider } from '@nestjs/common/interfaces/modules/provider.interface'
import type { Type } from '@nestjs/common/interfaces/type.interface'
import type { ValidationError } from 'class-validator'
import type { PlatformModuleOptions } from './platform.module.types'
import { DrizzleModule } from '@db/core'
import { LoggerModule } from '@libs/platform/modules'
import {
  BadRequestException,
  DynamicModule,
  Module,
  ValidationPipe,
} from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ClsModule } from 'nestjs-cls'
import { v4 as uuidv4 } from 'uuid'
import { TransformInterceptor } from './interceptors'
import { CustomCacheModule } from './modules/cache'
import { HealthModule } from './modules/health'

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const messages: string[] = []

  for (const error of errors) {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property

    if (error.constraints) {
      const constraintMessages = Object.values(error.constraints)
      if (constraintMessages.length > 0) {
        messages.push(`${propertyPath}${constraintMessages.join('，')}`)
      }
    }

    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children, propertyPath))
    }
  }

  return messages
}

@Module({})
export class PlatformModule {
  // 静态方法，用于注册模块并传递配置参数
  static register(options: PlatformModuleOptions = {}): DynamicModule {
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
    const imports: (DynamicModule | Type<any>)[] = [
      ClsModule.forRoot({
        global: true,
        middleware: {
          mount: true,
          generateId: true,
          idGenerator: (req: any) => req.headers['x-request-id'] || uuidv4(),
        },
      }),
    ]

    // 全局验证管道 - 数据格式校验
    const providers: Provider[] = []

    // 日志模块
    if (mergedOptions.enableLogger) {
      imports.push(LoggerModule)
    }

    // 数据库模块
    if (mergedOptions.enableDatabase) {
      imports.push(DrizzleModule)
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
          exceptionFactory: (errors) => {
            const messages = flattenValidationErrors(errors)
            return new BadRequestException(
              messages.length > 0 ? messages.join(',') : '参数校验失败',
            )
          },
        }),
      })
    }

    return {
      module: PlatformModule,
      imports,
      providers,
      exports: imports, // 导出所有导入的模块
    }
  }

  // 提供默认的 forRoot 方法，方便简单使用
  static forRoot(options?: PlatformModuleOptions): DynamicModule {
    return this.register(options)
  }
}
