import { PublicForumSectionGroupListItemDto } from '@libs/forum/section-group/dto/forum-section-group.dto'
import { ForumSectionGroupService } from '@libs/forum/section-group/forum-section-group.service'
import { ApiDoc, CurrentUser, OptionalAuth } from '@libs/platform/decorators'

import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/板块')
@Controller('app/forum/section-groups')
export class ForumSectionGroupController {
  constructor(
    private readonly forumSectionGroupService: ForumSectionGroupService,
  ) {}

  @Get('list')
  @OptionalAuth()
  @ApiDoc({
    summary: '查询论坛板块分组列表',
    model: PublicForumSectionGroupListItemDto,
    isArray: true,
  })
  async getList(@CurrentUser('sub') userId?: number) {
    return this.forumSectionGroupService.getVisibleSectionGroupList({
      userId,
    })
  }
}
