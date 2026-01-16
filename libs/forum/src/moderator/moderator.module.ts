import { Module } from '@nestjs/common'
import { ForumSectionModule } from '../section/forum-section.module'
import { ForumModeratorService } from './moderator.service'

/**
 * 版主模块
 * 提供论坛版主管理的完整功能
 */
@Module({
  imports: [ForumSectionModule],
  controllers: [],
  providers: [ForumModeratorService],
  exports: [ForumModeratorService],
})
export class ForumModeratorModule {}
