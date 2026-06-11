import {
  PublicForumSectionDetailDto,
  PublicForumSectionListItemDto,
  PublicForumSectionModeratorDto,
  QueryPublicForumSectionDto,
  QueryPublicForumSectionModeratorsDto,
} from '@libs/forum/section/dto/forum-section.dto'
import { ForumSectionService } from '@libs/forum/section/forum-section.service'
import { ApiDoc, CurrentUser, OptionalAuth } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto/base.dto'

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
    @Query() query: IdDto,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.forumSectionService.getVisibleSectionDetail(query.id, userId)
  }

  @Get('moderators')
  @ApiDoc({
    summary: '查询板块公开版主列表',
    model: PublicForumSectionModeratorDto,
    isArray: true,
  })
  async getModerators(@Query() query: QueryPublicForumSectionModeratorsDto) {
    return this.forumSectionService.getVisibleSectionModerators(query.sectionId)
  }
}
