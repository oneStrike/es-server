import * as process from 'node:process'
import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus'
import { CacheHealthIndicator } from './indicators/cache.health.indicator'
import { DatabaseHealthIndicator } from './indicators/database.health.indicator'

@ApiTags('健康检查模块')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly cacheIndicator: CacheHealthIndicator,
    private readonly dbIndicator: DatabaseHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  @HealthCheck()
  async healthCheck() {
    const result = await this.health.check([
      async () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      async () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
    ])

    return {
      ...result,
      meta: {
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      },
    }
  }

  @Get('ready')
  @HealthCheck()
  async readinessCheck() {
    const upload = this.configService.get('upload')
    const uploadPath = upload?.uploadDir || process.cwd()
    return this.health.check([
      async () => this.dbIndicator.ping('database'),
      async () => this.cacheIndicator.checkMemory('cache_memory'),
      async () => this.cacheIndicator.checkRedis('cache_redis'),
      async () =>
        this.disk.checkStorage('disk', {
          path: uploadPath,
          thresholdPercent: 0.9,
        }),
    ])
  }
}
