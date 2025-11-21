import * as process from 'node:process'
import { BaseModule } from '@libs/base'
import { CryptoModule } from '@libs/crypto'
import { HealthModule } from '@libs/health'
import { LoggerModule } from '@libs/logger'
import { UploadConfig } from '@libs/upload'
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'
import { HttpExceptionFilter } from './filters/http-exception.filter'
import { JwtAuthGuard } from './guards/auth.guard'
import { TransformInterceptor } from './interceptors/transform.interceptor'
import { AdminModule } from './modules/admin/admin.module'

@Module({
  imports: [
    // 配置模块 - 全局环境变量管理
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`], // 指定环境变量文件路径
      load: [UploadConfig], // 加载上传配置
      cache: true, // 缓存配置
    }),

    BaseModule.forRoot({
      enableDatabase: true,
    }),

    // 基础功能模块
    CryptoModule, // 加密模块
    LoggerModule,

    // 业务功能模块
    AdminModule, // 管理模块
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
        exceptionFactory: (errors) =>
          new BadRequestException(
            errors.map((error) => {
              const errorMsg: string[] = []
              if (error.constraints) {
                errorMsg.push(...Object.values(error.constraints))
              }
              return `${error.property}${errorMsg.join('，')}`
            }),
          ),
      }),
    },

    // 全局拦截器
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
