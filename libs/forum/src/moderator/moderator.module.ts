import { Module } from '@nestjs/common'
import { ForumSectionModule } from '../section/forum-section.module'
import { ModeratorController } from './moderator.controller'
import { ModeratorService } from './moderator.service'

/**
 * 版主模块
 * 提供论坛版主管理的完整功能
 */
@Module({
  imports: [ForumSectionModule],
  controllers: [ModeratorController],
  providers: [ModeratorService],
  exports: [ModeratorService],
})
export class ModeratorModule {}
