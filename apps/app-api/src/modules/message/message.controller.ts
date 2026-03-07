import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseUserNotificationDto,
  MessageNotificationService,
  NotificationUnreadCountDto,
  QueryUserNotificationListDto,
} from '@libs/message'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('消息中心')
@Controller('app/message')
export class MessageController {
  constructor(
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  @Get('notification/list')
  @ApiPageDoc({
    summary: '分页查询站内通知',
    model: BaseUserNotificationDto,
  })
  async list(
    @Query() query: QueryUserNotificationListDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageNotificationService.queryUserNotificationList(
      userId,
      query,
    )
  }

  @Get('notification/unread-count')
  @ApiDoc({
    summary: '获取未读通知数量',
    model: NotificationUnreadCountDto,
  })
  async unreadCount(@CurrentUser('sub') userId: number) {
    return this.messageNotificationService.getUnreadCount(userId)
  }

  @Post('notification/read')
  @ApiDoc({
    summary: '标记单条通知已读',
    model: IdDto,
  })
  async markRead(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.messageNotificationService.markRead(userId, body.id)
  }

  @Post('notification/read-all')
  @ApiDoc({
    summary: '标记全部通知已读',
    model: NotificationUnreadCountDto,
  })
  async markAllRead(@CurrentUser('sub') userId: number) {
    const result = await this.messageNotificationService.markAllRead(userId)
    return { count: result.count }
  }
}
