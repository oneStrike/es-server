/**
 * 下载模块。
 *
 * 说明：
 * - 提供章节内容下载功能
 * - 集成内容权限校验，确保用户有权限下载
 */
import { ContentPermissionModule } from '@libs/content/permission'
import { Module } from '@nestjs/common'
import { DownloadService } from './download.service'

@Module({
  imports: [ContentPermissionModule],
  providers: [DownloadService],
  exports: [DownloadService],
})
export class DownloadModule {}
