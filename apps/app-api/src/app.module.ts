import { BaseModule } from '@libs/base'
import {
  AliyunConfigRegister,
  AuthConfigRegister,
  DbConfigRegister,
  environmentValidationSchema,
  LoggerConfigRegister,
  RedisConfigRegister,
  RsaConfigRegister,
  UploadConfigRegister
} from '@libs/base/config'
import { HttpExceptionFilter } from '@libs/base/filters'
import { JwtAuthGuard, JwtAuthModule } from '@libs/base/modules'
import { getEnv } from '@libs/base/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigRegister } from './config/app.config'
import { appConfigValidationSchema } from './config/validation.config'
import { AppApiModule } from './modules/app.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', `.env.${getEnv()}`],
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
    BaseModule.forRoot(),
    JwtAuthModule,

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
  ],
})
export class AppModule { }
