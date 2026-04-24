import { statfs } from 'node:fs/promises'
import * as process from 'node:process'
import { Public } from '@libs/platform/decorators';
import { getEnv } from '@libs/platform/utils';
import { Controller, Get, HttpCode } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import { HealthService } from './health.service'

@ApiTags('健康检查模块')
@Controller()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  @Public()
  async healthCheck() {
    const heapUsed = process.memoryUsage().heapUsed
    const rss = process.memoryUsage().rss
    const memoryHeapStatus = heapUsed < 512 * 1024 * 1024 ? 'up' : 'down'
    const memoryRssStatus = rss < 1024 * 1024 * 1024 ? 'up' : 'down'
    const overallStatus =
      memoryHeapStatus === 'up' && memoryRssStatus === 'up' ? 'ok' : 'error'

    return {
      status: overallStatus,
      info: {
        memory_heap: {
          status: memoryHeapStatus,
          heapUsed,
        },
        memory_rss: {
          status: memoryRssStatus,
          rss,
        },
      },
      meta: {
        uptime: process.uptime(),
        environment: getEnv(),
      },
    }
  }

  @Get('ready')
  @Public()
  @HttpCode(200)
  async readinessCheck() {
    const upload = this.configService.get('upload')
    const uploadPath = upload?.localDir || process.cwd()
    try {
      const [database, cache, disk] = await Promise.all([
        this.healthService.ping('database'),
        this.healthService.checkCacheByEnv('cache'),
        this.checkDisk('disk', uploadPath, 0.9),
      ])
      const checks = { ...database, ...cache, ...disk }
      const status = Object.values(checks).every(
        (item: { status?: string }) => item.status === 'up',
      )
        ? 'ok'
        : 'error'
      return {
        status,
        info: checks,
      }
    } catch (error) {
      return {
        status: 'error',
        info: {
          error: String(error),
        },
      }
    }
  }

  private async checkDisk(key: string, path: string, thresholdPercent: number) {
    try {
      const stat = await statfs(path)
      const total = stat.blocks * stat.bsize
      const free = stat.bavail * stat.bsize
      const usedPercent = total > 0 ? (total - free) / total : 1
      return {
        [key]: {
          status: usedPercent < thresholdPercent ? 'up' : 'down',
          usedPercent,
        },
      }
    } catch (error) {
      return {
        [key]: {
          status: 'down',
          error: String(error),
        },
      }
    }
  }
}
