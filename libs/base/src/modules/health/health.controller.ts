import * as process from 'node:process'
import { Public } from '@libs/base/decorators'
import { getEnv } from '@libs/base/utils'
import { Controller, Get, HttpCode } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus'
import { HealthService } from './health.service'

@ApiTags('健康检查模块')
@Controller('system')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  @Public()
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
        environment: getEnv(),
      },
    }
  }

  @Get('ready')
  @HealthCheck()
  @Public()
  @HttpCode(200)
  async readinessCheck() {
    const upload = this.configService.get('upload')
    const uploadPath = upload?.uploadDir || process.cwd()
    try {
      return await this.health.check([
        async () => this.healthService.ping('database'),
        async () => this.healthService.checkCacheByEnv('cache'),
        async () =>
          this.disk.checkStorage('disk', {
            path: uploadPath,
            thresholdPercent: 0.9,
          }),
      ])
    } catch (error: any) {
      return error?.response ?? error
    }
  }
}
