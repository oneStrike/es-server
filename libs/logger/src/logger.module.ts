import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { WinstonModule } from 'nest-winston'
import { LoggerService } from './logger.service'

/**
 * 全局日志模块
 * 提供统一的 LoggerService 服务，包含三种类型的日志器：
 * - pickLogger(apiType): 根据API类型自动选择合适的日志器
 * - getSystemLogger(): 获取系统级日志器
 * - getAdminLogger(): 获取管理员操作日志器
 * - getClientLogger(): 获取客户端操作日志器
 *
 * 环境变量配置说明：
 * - LOG_LEVEL: 日志级别（默认：production环境为info，开发环境为debug）
 * - LOG_PATH: 日志文件存储路径（默认：项目logs目录）
 * - LOG_MAX_SIZE: 单个日志文件最大大小（默认：50m）
 * - LOG_RETAIN_DAYS: 日志文件保留天数（默认：30天）
 * - LOG_COMPRESS: 是否压缩历史日志文件（默认：true）
 * - LOG_CONSOLE_LEVEL: 控制台输出日志级别（默认：与LOG_LEVEL相同）
 *
 * 使用方式：
 * ```typescript
 * @Injectable()
 * export class AnyService {
 *   constructor(private readonly loggerService: LoggerService) {}
 *
 *   someMethod() {
 *     // 根据API类型选择日志器
 *     const logger = this.loggerService.pickLogger(ApiTypeEnum.ADMIN)
 *     logger.info('操作日志')
 *
 *     // 或直接获取特定日志器
 *     const systemLogger = this.loggerService.getSystemLogger()
 *     systemLogger.info('系统日志')
 *   }
 * }
 * ```
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    WinstonModule.forRootAsync({
      useFactory: (loggerService: LoggerService) =>
        loggerService.buildLoggerOptions(),
      inject: [LoggerService],
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
