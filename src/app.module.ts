import * as process from 'node:process'
import { CacheModule } from '@nestjs/cache-manager'
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { CustomPrismaModule } from 'nestjs-prisma/dist/custom'
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'
import { LoggerInterceptor } from '@/common/interceptors/logger.interceptor'
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor'
import { CryptoModule } from '@/common/module/crypto/crypto.module'
import { LoggerModule } from '@/common/module/logger/logger.module'
import uploadConfig from '@/config/upload.config'
import { AdminModule } from '@/modules/admin/admin.module'
import { ClientModule } from '@/modules/client/client.module'
import { PrismaService } from '@/prisma/prisma.connect'
import { JwtAuthGuard } from './common/guards/auth.guard'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 设置为全局模块，其他模块可直接使用
      envFilePath: ['.env', `.env.${process.env.NODE_ENV || 'development'}`], // 指定环境变量文件路径
      load: [uploadConfig], // 加载上传配置
      cache: true, // 缓存配置
    }),
    CustomPrismaModule.forRootAsync({
      isGlobal: true,
      name: 'PrismaService',
      useClass: PrismaService,
    }),
    CacheModule.register({
      isGlobal: true,
      namespace: 'Akaiito',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 30,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),
    LoggerModule, // 添加日志模块
    CryptoModule, // 添加加密模块
    AdminModule,
    ClientModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors) => {
          return new BadRequestException(
            errors.map((error) => `${error.property}数据格式校验失败`),
          )
        },
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor, // 日志拦截器（最先执行）
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor, // 响应转换拦截器
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
