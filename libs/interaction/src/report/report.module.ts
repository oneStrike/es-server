import { GrowthEventBridgeModule } from '@libs/growth/growth-reward/growth-event-bridge.module';
import { Module } from '@nestjs/common'
import { ReportGrowthService } from './report-growth.service'
import { ReportService } from './report.service'

@Module({
  imports: [GrowthEventBridgeModule],
  providers: [ReportService, ReportGrowthService],
  exports: [ReportService],
})
export class ReportModule {}
