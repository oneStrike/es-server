import {
  BaseForumNotificationDto,
  ForumNotificationService,
} from '@libs/forum'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  ForumNotificationBatchResultDto,
  ForumNotificationUnreadCountDto,
  QueryUserForumNotificationDto,
} from './dto/forum-notification.dto'

@ApiTags('论坛通知')
@Controller('app/forum/notification')
export class ForumNotificationController {
  constructor(
    private readonly forumNotificationService: ForumNotificationService,
  ) {}

  @Get('page')
  @ApiPageDoc({
    summary: '分页查询我的论坛通知',
    model: BaseForumNotificationDto,
  })
  async getPage(
    @Query() query: QueryUserForumNotificationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.forumNotificationService.getUserNotificationPage(userId, query)
  }

  @Get('detail')
  @ApiDoc({
    summary: '获取我的论坛通知详情',
    model: BaseForumNotificationDto,
  })
  async getDetail(@Query() query: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumNotificationService.getNotificationDetail(query.id, userId)
  }

  @Get('unread-count')
  @ApiDoc({
    summary: '获取论坛通知未读数量',
    model: ForumNotificationUnreadCountDto,
  })
  async getUnreadCount(@CurrentUser('sub') userId: number) {
    return this.forumNotificationService.getUnreadCount(userId)
  }

  @Post('read')
  @ApiDoc({
    summary: '标记论坛通知已读',
    model: IdDto,
  })
  async markRead(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.forumNotificationService.markRead(userId, body.id)
  }

  @Post('read-all')
  @ApiDoc({
    summary: '标记全部论坛通知已读',
    model: ForumNotificationBatchResultDto,
  })
  async markAllRead(@CurrentUser('sub') userId: number) {
    return this.forumNotificationService.markAllRead(userId)
  }
}
