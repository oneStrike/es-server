import { ForumSearchDto, ForumSearchResultDto } from '@libs/forum/search/dto/search.dto';
import { ForumSearchService } from '@libs/forum/search/search.service';
import { ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛管理/搜索')
@Controller('admin/forum/search')
export class ForumSearchController {
  constructor(private readonly forumSearchService: ForumSearchService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页搜索论坛主题与回复',
    model: ForumSearchResultDto,
  })
  async getPage(@Query() query: ForumSearchDto) {
    return this.forumSearchService.searchAdmin(query)
  }
}
