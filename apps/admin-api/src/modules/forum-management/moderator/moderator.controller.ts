import { ApiDoc, ApiPageDoc } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  ForumModeratorDto,
  ForumModeratorService,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from '@libs/forum/moderator'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('/admin/forum/moderators')
@ApiTags('论坛模块/版主管理')
export class ModeratorController {
  constructor(private readonly forumModeratorService: ForumModeratorService) {}

  @Get('list')
  @ApiPageDoc({
    summary: '查看版主列表',
    model: ForumModeratorDto,
  })
  async getModeratorList(@Query() query: QueryForumModeratorDto) {
    return this.forumModeratorService.getModeratorPage(query)
  }

  @Post('add')
  @ApiDoc({
    summary: '添加版主',
    model: ForumModeratorDto,
  })
  async addModerator(@Body() dto: CreateForumModeratorDto) {
    return this.forumModeratorService.createModerator(dto)
  }

  @Post('update')
  @ApiDoc({
    summary: '更新版主信息',
    model: ForumModeratorDto,
  })
  async updateModerator(@Body() dto: UpdateForumModeratorDto) {
    return this.forumModeratorService.updateModerator(dto)
  }

  @Post('remove')
  @ApiDoc({
    summary: '移除版主',
    model: ForumModeratorDto,
  })
  async removeModerator(@Body() dto: IdDto) {
    return this.forumModeratorService.removeModerator(dto)
  }

  @Post('section-assign')
  @ApiDoc({
    summary: '分配版主管理的板块',
    model: ForumModeratorDto,
  })
  async assignModeratorSection(@Body() dto: AssignForumModeratorSectionDto) {
    await this.forumModeratorService.assignModeratorSection(dto)
    return true
  }
}
