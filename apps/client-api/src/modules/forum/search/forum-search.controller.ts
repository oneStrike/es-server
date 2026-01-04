import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { SearchService } from '@libs/forum/search'
import { SearchDto } from '@libs/forum/search/dto/search.dto'
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
  @ApiDoc({
    summary: '搜索论坛内容',
    description: '搜索论坛主题和回复内容',
    response: 'SearchResultPageDto',
  })
  @ApiPageDoc()
  async search(@Query() searchDto: SearchDto) {
    return this.searchService.search(searchDto)
  }
}
