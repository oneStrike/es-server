import {
  ForumModeratorApplicationService,
} from '@libs/forum'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  CreateForumModeratorApplicationDto,
  ForumModeratorApplicationDto,
  QueryForumModeratorApplicationDto,
} from './dto/forum-moderator-application.dto'

@ApiTags('版主申请')
@Controller('app/forum/moderator-application')
export class ForumModeratorApplicationController {
  constructor(
    private readonly forumModeratorApplicationService: ForumModeratorApplicationService,
  ) {}

  @Get('page')
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
    model: ForumModeratorApplicationDto,
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
    model: IdDto,
  })
  async delete(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumModeratorApplicationService.deleteMyApplication(
      userId,
      body.id,
    )
  }
}
