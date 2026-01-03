import { Module } from '@nestjs/common'
import { ModeratorModule } from './moderator/moderator.module'
import { AuditModule } from './audit/audit.module'
import { ConfigModule } from './config/config.module'
import { AnalyticsModule } from './analytics/analytics.module'

@Module({
  imports: [ModeratorModule, AuditModule, ConfigModule, AnalyticsModule],
})
export class ForumManagementModule {}
