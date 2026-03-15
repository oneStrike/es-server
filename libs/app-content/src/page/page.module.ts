import { DrizzleModule } from '@db/drizzle.module'
import { Module } from '@nestjs/common'
import { AppPageService } from './page.service'

/**
 * APP页面配置模块
 * 提供页面配置的管理功能
 */
@Module({
  imports: [DrizzleModule],
  providers: [AppPageService],
  exports: [AppPageService],
})
export class AppPageModule {}
