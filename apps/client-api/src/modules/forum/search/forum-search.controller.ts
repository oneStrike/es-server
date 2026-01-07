import { ApiPageDoc } from '@libs/base/decorators'
import { SearchDto, SearchService } from '@libs/forum'
import { Controller, Get, Query } from '@nestjs/common'
import { InjectSearchService } from './forum-search.constant'

/**
 * 客户端论坛搜索控制器
 */
@Controller('forum/search')
export class ForumSearchController {
  constructor(
    @InjectSearchService()
    private readonly searchService: SearchService,
  ) {}

  /**
   * 搜索论坛内容
   */
  @Get()
  @ApiPageDoc({
    summary: '搜索论坛内容',
  })
  async search(@Query() searchDto: SearchDto) {
    return this.searchService.search(searchDto)
  }
}
