import { PrismaService } from '@libs/base/database'
import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
  imports: [
    TerminusModule.forRoot({
      errorLogStyle: 'json',
      gracefulShutdownTimeoutMs: 1000,
      logger: false, // 禁用Terminus内置的日志记录，避免与HttpExceptionFilter重复
    }),
  ],
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
})
export class HealthModule {}
