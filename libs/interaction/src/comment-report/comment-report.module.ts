import { Module } from '@nestjs/common'
import { CommentReportService } from './comment-report.service'

@Module({
  providers: [CommentReportService],
  exports: [CommentReportService],
})
export class CommentReportModule {}
