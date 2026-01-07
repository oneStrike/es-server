import { Module } from '@nestjs/common'
import { ForumReportController } from './forum-report.controller'
import { ForumReportService } from './forum-report.service'

@Module({
  controllers: [ForumReportController],
  providers: [ForumReportService],
  exports: [ForumReportService],
})
export class ForumReportModule {}
