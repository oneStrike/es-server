import {
  ForumSectionService,
  PublicForumSectionDetailDto,
  PublicForumSectionListItemDto,
  QueryPublicForumSectionDetailDto,
  QueryPublicForumSectionDto,
} from '@libs/forum/section'
import {
  ApiDoc,
  CurrentUser,
  OptionalAuth,
} from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/板块')
@Controller('app/forum/sections')
export class ForumSectionController {
  constructor(private readonly forumSectionService: ForumSectionService) {}

  @Get('list')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询论坛板块列表',
    model: PublicForumSectionListItemDto,
    isArray: true,
  })
  async getList(
    @Query() query: QueryPublicForumSectionDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumSectionService.getVisibleSectionList({
      ...query,
      userId,
    })
  }

  @Get('detail')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询论坛板块详情',
    model: PublicForumSectionDetailDto,
  })
  async getDetail(
    @Query() query: QueryPublicForumSectionDetailDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumSectionService.getVisibleSectionDetail(
      query.id,
      userId ?? query.userId,
    )
  }
}
