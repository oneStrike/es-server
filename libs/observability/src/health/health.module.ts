import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { HealthService } from './health.service'

@Module({
  imports: [DrizzleModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
