import process from 'node:process'
import { BaseAuthModule } from '@libs/auth'
import { BaseModule } from '@libs/base'
import {
  AuthConfigRegister,
  DbConfigRegister,
  LoggerConfigRegister,
  RedisConfigRegister,
} from '@libs/config'
import { CryptoModule } from '@libs/crypto'
import { HealthModule } from '@libs/health'
import { LoggerModule } from '@libs/logger'
import { UploadConfigRegister } from '@libs/upload'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'
import { AppConfigRegister } from './config/app.config'
import { HttpExceptionFilter } from './filters/http-exception.filter'
import { JwtAuthGuard } from './guards/auth.guard'
import { TransformInterceptor } from './interceptors/transform.interceptor'
import { AdminModule } from './modules/admin.module'

@Module({
  imports: [
    // 配置模块 - 全局环境变量管理
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`], // 指定环境变量文件路径
      load: [
        AppConfigRegister,
        AuthConfigRegister,
        DbConfigRegister,
        UploadConfigRegister,
        RedisConfigRegister,
        LoggerConfigRegister,
      ], // 加载上传配置
      cache: true, // 缓存配置
    }),

    BaseModule.forRoot({
      enableDatabase: true,
    }),

    BaseAuthModule,
    // 基础功能模块
    CryptoModule, // 加密模块
    LoggerModule,

    // 业务功能模块
    AdminModule, // 管理模块
    HealthModule, // 健康检查模块
  ],

  controllers: [],

  providers: [
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
