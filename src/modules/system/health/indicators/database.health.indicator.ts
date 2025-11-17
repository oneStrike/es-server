import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { PrismaService } from '@/prisma/prisma.connect'

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prismaService: PrismaService,
  ) {}

  async ping(key = 'database') {
    const indicator = this.healthIndicatorService.check(key)
    try {
      await this.prismaService.client.$queryRaw`SELECT 1`
      return indicator.up()
    } catch (error) {
      return indicator.down({ error: String(error) })
    }
  }
}
