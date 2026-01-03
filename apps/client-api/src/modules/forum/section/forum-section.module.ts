import { Module } from '@nestjs/common'
import { ForumSectionController } from './forum-section.controller'

/**
 * 客户端论坛板块模块
 * 提供客户端论坛板块查询功能
 */
@Module({
  imports: [],
  controllers: [ForumSectionController],
  providers: [],
  exports: [],
})
export class ForumSectionModule {}
