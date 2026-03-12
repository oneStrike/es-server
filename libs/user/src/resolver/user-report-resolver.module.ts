import { ReportModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { UserReportResolver } from './user-report.resolver'

/**
 * 用户举报解析器模块
 * 注册用户举报解析器到举报服务
 */
@Module({
  imports: [ReportModule],
  providers: [UserReportResolver],
  exports: [UserReportResolver],
})
export class UserReportResolverModule {}
