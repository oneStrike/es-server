import { DrizzleModule } from '@db/drizzle.module'
import { Module } from '@nestjs/common'
import { AppAnnouncementService } from './announcement.service'

/**
 * 系统公告模块
 * 提供公告的管理功能
 */
@Module({
  imports: [DrizzleModule],
  providers: [AppAnnouncementService],
  exports: [AppAnnouncementService],
})
export class AppAnnouncementModule {}
