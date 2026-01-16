import { Module } from '@nestjs/common'
import { ForumSearchService } from './search.service'

/**
 * 搜索模块
 * 提供论坛搜索的完整功能
 */
@Module({
  imports: [],
  providers: [ForumSearchService],
  exports: [ForumSearchService],
})
export class ForumSearchModule {}
