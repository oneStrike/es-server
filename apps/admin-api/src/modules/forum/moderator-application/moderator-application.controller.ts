import {
  ForumModeratorApplicationService,
} from '@libs/forum'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AuditForumModeratorApplicationDto,
  ForumModeratorApplicationDto,
  QueryForumModeratorApplicationDto,
} from './dto/moderator-application.dto'

@ApiTags('论坛管理/版主申请')
@Controller('admin/forum/moderator-application')
export class ForumModeratorApplicationController {
  constructor(
    private readonly forumModeratorApplicationService: ForumModeratorApplicationService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询版主申请',
    model: ForumModeratorApplicationDto,
  })
  async getPage(@Query() query: QueryForumModeratorApplicationDto) {
    return this.forumModeratorApplicationService.getApplicationPage(query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取版主申请详情',
    model: ForumModeratorApplicationDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumModeratorApplicationService.getApplicationDetail(query.id)
  }

  @Post('audit')
  @ApiDoc({
    summary: '审核版主申请',
    model: ForumModeratorApplicationDto,
  })
  async audit(
    @Body() body: AuditForumModeratorApplicationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorApplicationService.auditApplication(userId, body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除版主申请',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumModeratorApplicationService.deleteApplication(body.id)
  }
}
