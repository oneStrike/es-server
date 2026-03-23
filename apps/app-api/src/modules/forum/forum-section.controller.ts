import { ForumSectionService } from '@libs/forum/section'
import {
  ApiDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AppForumSectionDetailDto,
  AppForumSectionListItemDto,
  QueryAppForumSectionDto,
} from './dto/forum-section.dto'

@ApiTags('论坛/板块')
@Controller('app/forum/sections')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  @Get('list')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询论坛板块列表',
    model: AppForumSectionListItemDto,
    isArray: true,
  })
  async getList(
    @Query() query: QueryAppForumSectionDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumSectionService.getPublicSectionList({
      ...query,
      userId,
    })
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询论坛板块详情',
    model: AppForumSectionDetailDto,
  })
  async getDetail(@Query() query: IdDto, @CurrentUser('sub') userId?: number) {
    return this.forumSectionService.getPublicSectionDetail(query.id, userId)
  }
}
