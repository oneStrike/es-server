import {
  BaseForumNotificationDto,
  ForumNotificationService,
} from '@libs/forum'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  CreateForumNotificationDto,
  QueryForumNotificationDto,
} from './dto/notification.dto'

@ApiTags('论坛管理/通知管理')
@Controller('admin/forum/notification')
export class ForumNotificationController {
  constructor(
    private readonly forumNotificationService: ForumNotificationService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询论坛通知',
    model: BaseForumNotificationDto,
  })
  async getPage(@Query() query: QueryForumNotificationDto) {
    return this.forumNotificationService.getNotificationPage({
      ...query,
      userId: query.userId ?? undefined,
      topicId: query.topicId ?? undefined,
    })
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取论坛通知详情',
    model: BaseForumNotificationDto,
  })
  async getDetail(@Query() query: IdDto) {
    return this.forumNotificationService.getNotificationDetail(query.id)
  }

  @Post('create')
  @ApiDoc({
    summary: '创建论坛通知',
    model: BaseForumNotificationDto,
  })
  async create(@Body() body: CreateForumNotificationDto) {
    return this.forumNotificationService.createNotification(body)
  }

  @Post('delete')
  @ApiDoc({
    summary: '删除论坛通知',
    model: IdDto,
  })
  async delete(@Body() body: IdDto) {
    return this.forumNotificationService.deleteNotification(body.id)
  }
}
