import { Module } from '@nestjs/common'
import { AnalyticsModule } from './analytics/analytics.module'
import { AuditModule } from './audit/audit.module'
import { ConfigModule } from './config/config.module'
import { ModeratorModule } from './moderator/moderator.module'

@Module({
  imports: [ModeratorModule, AuditModule, ConfigModule, AnalyticsModule],
})
export class ForumManagementModule {}
