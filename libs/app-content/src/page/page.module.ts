import { Module } from '@nestjs/common'
import { AppPageService } from './page.service'

/**
 * APP页面配置模块
 * 提供页面配置的管理功能
 */
@Module({
  providers: [AppPageService],
  exports: [AppPageService],
})
export class AppPageModule {}
