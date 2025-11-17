import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { PrismaService } from '@/prisma/prisma.connect'
import { HealthController } from './health.controller'
import { CacheHealthIndicator } from './indicators/cache.health.indicator'
import { DatabaseHealthIndicator } from './indicators/database.health.indicator'

@Module({
  imports: [
    TerminusModule.forRoot({
      errorLogStyle: 'json',
      gracefulShutdownTimeoutMs: 1000,
      logger: false, // 禁用Terminus内置的日志记录，避免与HttpExceptionFilter重复
    }),
  ],
  controllers: [HealthController],
  providers: [CacheHealthIndicator, DatabaseHealthIndicator, PrismaService],
})
export class HealthModule {}
