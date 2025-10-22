import * as process from 'node:process'
import { CacheModule } from '@nestjs/cache-manager'
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { CustomPrismaModule } from 'nestjs-prisma/dist/custom'

import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor'
import { LoggerModule } from '@/common/module/logger/logger.module'
import uploadConfig from '@/config/upload.config'
import { AdminModule } from '@/modules/admin/admin.module'
import { ClientModule } from '@/modules/client/client.module'
import { PrismaService } from '@/prisma/prisma.connect'
import { GuardsModule } from './common/guards/guards.module'
import { SmartJwtAuthGuard } from './common/guards/smart-jwt-auth.guard'

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

    LoggerModule, // 添加日志模块
    GuardsModule,
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
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    {
      provide: APP_GUARD,
      useClass: SmartJwtAuthGuard,
    },
  ],
})
export class AppModule {}
