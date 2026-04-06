import { CreateForumModeratorApplicationDto, ForumModeratorApplicationDto, QueryForumModeratorApplicationDto } from '@libs/forum/moderator-application/dto/moderator-application.dto';
import { ForumModeratorApplicationService } from '@libs/forum/moderator-application/moderator-application.service';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { CurrentUser } from '@libs/platform/decorators/current-user.decorator';
import { IdDto } from '@libs/platform/dto/base.dto';
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛/版主申请')
@Controller('app/forum/moderator-application')
export class ForumModeratorApplicationController {
  constructor(
    private readonly forumModeratorApplicationService: ForumModeratorApplicationService,
  ) {}

  @Get('my/page')
  @ApiPageDoc({
    summary: '分页查询我的版主申请',
    model: ForumModeratorApplicationDto,
  })
  async getPage(
    @Query() query: QueryForumModeratorApplicationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorApplicationService.getMyApplicationPage(userId, query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取我的版主申请详情',
    model: ForumModeratorApplicationDto,
  })
  async getDetail(@Query() query: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumModeratorApplicationService.getMyApplicationDetail(
      userId,
      query.id,
    )
  }

  @Post('create')
  @ApiDoc({
    summary: '提交版主申请',
    model: Boolean,
  })
  async create(
    @Body() body: CreateForumModeratorApplicationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumModeratorApplicationService.createApplication(userId, {
      ...body,
      permissions: body.permissions ?? undefined,
      remark: body.remark ?? undefined,
    })
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除我的版主申请',
    model: Boolean,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumModeratorApplicationService.deleteMyApplication(
      userId,
      body.id,
    )
  }
}
