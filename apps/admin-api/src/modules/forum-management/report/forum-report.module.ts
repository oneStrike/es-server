import { ForumReportModule as ForumReportModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumReportController } from './forum-report.controller'

@Module({
  imports: [ForumReportModuleLib],
  controllers: [ForumReportController],
  providers: [],
  exports: [],
})
export class ForumReportModule {}
