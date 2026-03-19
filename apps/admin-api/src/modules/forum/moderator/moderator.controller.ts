import {
  AssignForumModeratorSectionDto,
  CreateForumModeratorDto,
  ForumModeratorDto,
  ForumModeratorService,
  QueryForumModeratorDto,
  UpdateForumModeratorDto,
} from '@libs/forum'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@Controller('admin/forum/moderators')
@ApiTags('论坛管理/版主管理')
export class ModeratorController {
  constructor(private readonly forumModeratorService: ForumModeratorService) {}

  @Get('page')
  @ApiPageDoc({
    summary: '查看版主列表',
    model: ForumModeratorDto,
  })
  async getModeratorList(@Query() query: QueryForumModeratorDto) {
    return this.forumModeratorService.getModeratorPage(query)
  }

  @Post('create')
  @ApiDoc({
    summary: '添加版主',
    model: ForumModeratorDto,
  })
  async createModerator(@Body() dto: CreateForumModeratorDto) {
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

  @Post('delete')
  @ApiDoc({
    summary: '移除版主',
    model: ForumModeratorDto,
  })
  async deleteModerator(@Body() dto: IdDto) {
    return this.forumModeratorService.removeModerator(dto)
  }

  @Post('assign-section')
  @ApiDoc({
    summary: '分配版主管理的板块',
    model: ForumModeratorDto,
  })
  async assignModeratorSection(@Body() dto: AssignForumModeratorSectionDto) {
    await this.forumModeratorService.assignModeratorSection(dto)
    return true
  }
}
