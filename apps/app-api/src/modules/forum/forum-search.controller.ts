import {
  ForumSearchDto,
  ForumSearchResultDto,
  ForumSearchService,
} from '@libs/forum/search'
import {
  ApiPageDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/搜索')
@Controller('app/forum/search')
export class ForumSearchController {
  constructor(private readonly forumSearchService: ForumSearchService) {}

  @Get('page')
  @OptionalAuth()
  @ApiPageDoc({
    summary: '分页搜索论坛主题与回复',
    model: ForumSearchResultDto,
  })
  async getPage(
    @Query() query: ForumSearchDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumSearchService.searchPublic(query, userId)
  }
}
