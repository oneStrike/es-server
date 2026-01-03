import { Module } from '@nestjs/common'
import { SearchService } from './search.service'

/**
 * 搜索模块
 * 提供论坛搜索的完整功能
 */
@Module({
  imports: [],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
