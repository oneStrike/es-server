import { Module } from '@nestjs/common'
import { ForumSearchController } from './forum-search.controller'
import { SearchModule } from '@libs/forum/search'

/**
 * 客户端论坛搜索模块
 */
@Module({
  imports: [SearchModule],
  controllers: [ForumSearchController],
  providers: [],
  exports: [],
})
export class ForumSearchModule {}
