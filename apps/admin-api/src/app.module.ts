import { JwtAuthGuard, JwtAuthModule } from '@libs/auth'
import { BaseModule } from '@libs/base'
import {
  AuthConfigRegister,
  DbConfigRegister,
  LoggerConfigRegister,
  RedisConfigRegister,
  RsaConfigRegister,
  UploadConfigRegister,
} from '@libs/config'
import { CryptoModule } from '@libs/crypto'
import { HttpExceptionFilter } from '@libs/filters'
import { HealthModule } from '@libs/health'
import { LoggerModule } from '@libs/logger'
import { getEnv } from '@libs/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { AppConfigRegister } from './config/app.config'
import { AdminModule } from './modules/admin.module'

@Module({
  imports: [
    // 配置模块 - 全局环境变量管理
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      envFilePath: ['.env', `.env.${getEnv()}`], // 指定环境变量文件路径
      load: [
        AppConfigRegister,
        AuthConfigRegister,
        DbConfigRegister,
        UploadConfigRegister,
        RedisConfigRegister,
        LoggerConfigRegister,
        RsaConfigRegister,
      ], // 加载上传配置
      cache: true, // 缓存配置
    }),
    BaseModule.forRoot(),
    JwtAuthModule,
    CryptoModule,
    LoggerModule,
    // 业务功能模块
    AdminModule, // 管理模块
    HealthModule, // 健康检查模块
  ],
  providers: [
    // 全局异常过滤器
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // JWT 认证守卫
    },
  ],
})
export class AppModule {}
