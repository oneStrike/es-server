import { BaseModule } from '@libs/base'
import {
  AuthConfigRegister,
  DbConfigRegister,
  environmentValidationSchema,
  LoggerConfigRegister,
  RedisConfigRegister,
  RsaConfigRegister,
  UploadConfigRegister,
} from '@libs/base/config'
import { HttpExceptionFilter } from '@libs/base/filters'
import { JwtAuthGuard, JwtAuthModule } from '@libs/base/modules'
import { getEnv } from '@libs/base/utils'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD } from '@nestjs/core'
import { AppConfigRegister } from './config/app.config'
import { appConfigValidationSchema } from './config/validation.config'
import { ClientApiModule } from './modules/client.module'

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

    ClientApiModule,
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
