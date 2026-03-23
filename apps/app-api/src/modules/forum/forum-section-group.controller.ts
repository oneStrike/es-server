import { ForumSectionGroupService } from '@libs/forum/section-group'
import { ApiDoc, CurrentUser, OptionalAuth } from '@libs/platform/decorators'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AppForumSectionGroupListItemDto } from './dto/forum-section-group.dto'

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
    model: AppForumSectionGroupListItemDto,
    isArray: true,
  })
  async getList(@CurrentUser('sub') userId?: number) {
    return this.forumSectionGroupService.getPublicSectionGroupList({
      userId,
    })
  }
}
