import {
  AliyunConfigRegister,
  AuthConfigRegister,
  DbConfigRegister,
  environmentValidationSchema,
  LoggerConfigRegister,
  RedisConfigRegister,
  RsaConfigRegister,
  UploadConfigRegister
} from '@libs/platform/config'
import { HttpExceptionFilter } from '@libs/platform/filters'
import { PlatformModule } from '@libs/platform/module'
import { JwtAuthGuard, JwtAuthModule } from '@libs/platform/modules'
import { getEnv } from '@libs/platform/utils'
import { UserModule as UserCoreModule } from '@libs/user/core'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigRegister } from './config/app.config'
import { appConfigValidationSchema } from './config/validation.config'
import { AppApiModule } from './modules/app.module'
import { AppUserStatusGuard } from './modules/auth/app-user-status.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        'apps/app-api/.env',
        `apps/app-api/.env.${getEnv()}`,
        '.env',
        `.env.${getEnv()}`,
      ],
      load: [
        AppConfigRegister,
        AuthConfigRegister,
        DbConfigRegister,
        UploadConfigRegister,
        RedisConfigRegister,
        LoggerConfigRegister,
        RsaConfigRegister,
        AliyunConfigRegister,
      ],
      validationSchema: environmentValidationSchema.append(
        appConfigValidationSchema,
      ),
    }),
    /**
     * 启用 ScheduleModule 以支持定时任务。
     * 定时任务用于定期清理过期和已撤销的 Token
     */
    ScheduleModule.forRoot(),
    PlatformModule.forRoot(),
    JwtAuthModule,
    UserCoreModule,

    AppApiModule,
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
      useClass: AppUserStatusGuard, // 应用端用户状态守卫
    },
  ],
})
export class AppModule { }
