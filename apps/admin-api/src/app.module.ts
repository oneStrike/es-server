import {
  AuthConfigRegister,
  DbConfigRegister,
  environmentValidationSchema,
  LoggerConfigRegister,
  RedisConfigRegister,
  RsaConfigRegister,
  UploadConfigRegister,
} from '@libs/platform/config'
import { HttpExceptionFilter } from '@libs/platform/filters'
import { JwtAuthGuard } from '@libs/platform/modules/auth/auth.guard'
import { JwtAuthModule } from '@libs/platform/modules/auth/auth.module'
import { PlatformModule } from '@libs/platform/platform.module'
import { getEnv } from '@libs/platform/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { AuditInterceptor } from './common/interceptors/audit.interceptor'
import { AppConfigRegister } from './config/app.config'
import { appConfigValidationSchema } from './config/validation.config'
import { AdminModule } from './modules/admin.module'
import { AdminUserStatusGuard } from './modules/auth/admin-user-status.guard'
import { AuditModule } from './modules/system/audit/audit.module'

@Module({
  imports: [
    // 配置模块 - 全局环境变量管理
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      cache: true, // 缓存配置
      envFilePath: [
        'apps/admin-api/.env',
        `apps/admin-api/.env.${getEnv()}`,
        '.env',
        `.env.${getEnv()}`,
      ], // 指定环境变量文件路径
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
    PlatformModule.forRoot(),
    JwtAuthModule,
    ScheduleModule.forRoot(),
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
      provide: APP_GUARD,
      useClass: AdminUserStatusGuard, // 管理端用户状态守卫
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor, // 全局审计日志拦截器
    },
  ],
})
export class AppModule {}
