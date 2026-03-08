import { ReportModule as ReportCoreModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { ReportController } from './report.controller'

@Module({
  imports: [ReportCoreModule],
  controllers: [ReportController],
})
export class ReportModule {}
