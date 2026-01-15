import { ForumReportModule as ForumReportModuleLib } from '@libs/forum/report'
import { Module } from '@nestjs/common'
import { ForumReportController } from './forum-report.controller'

@Module({
  imports: [ForumReportModuleLib],
  controllers: [ForumReportController],
  providers: [],
  exports: [],
})
export class ForumReportModule {}
