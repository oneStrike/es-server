import { JwtAuthGuard, JwtAuthModule } from '@libs/auth'
import { BaseModule } from '@libs/base'
import {
  AuthConfigRegister,
  DbConfigRegister,
  environmentValidationSchema,
  LoggerConfigRegister,
  RedisConfigRegister,
  RsaConfigRegister,
  UploadConfigRegister,
} from '@libs/config'
import { HttpExceptionFilter } from '@libs/filters'
import { getEnv } from '@libs/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'
import { AppConfigRegister } from './config/app.config'
import { appConfigValidationSchema } from './config/validation.config'
import { AdminModule } from './modules/admin.module'
import { AuditModule } from './modules/system/audit/audit.module'

@Module({
  imports: [
    // 配置模块 - 全局环境变量管理
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      cache: true, // 缓存配置
      envFilePath: ['.env', `.env.${getEnv()}`], // 指定环境变量文件路径
      load: [
        AppConfigRegister,
        AuthConfigRegister,
        DbConfigRegister,
        UploadConfigRegister,
        RedisConfigRegister,
        LoggerConfigRegister,
        RsaConfigRegister,
      ],
      validationSchema: environmentValidationSchema.append(
        appConfigValidationSchema,
      ),
    }),
    BaseModule.forRoot(),
    JwtAuthModule,
    // 业务功能模块
    AuditModule, // 业务审计模块
    AdminModule, // 管理模块
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
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor, // 全局审计日志拦截器
    },
  ],
})
export class AppModule {}
