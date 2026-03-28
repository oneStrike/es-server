import { ReportModule as InteractionReportModule } from '@libs/interaction/report'
import { Module } from '@nestjs/common'
import { ReportController } from './report.controller'

@Module({
  imports: [InteractionReportModule],
  controllers: [ReportController],
})
export class AdminReportModule {}
