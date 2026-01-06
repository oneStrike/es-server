import { PageDto } from '@libs/base/dto'
import { NotificationService } from '@libs/forum'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('论坛模块/系统通知')
@Controller('admin/forum/notification')
export class AdminForumNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('list')
  async queryNotificationList(@Query() queryNotificationListDto: PageDto) {
    return this.notificationService.queryNotificationList(
      queryNotificationListDto,
    )
  }

  @Get('unread-count')
  async getUnreadCount(@Query() getUnreadCountDto: GetUnreadCountDto) {
    return this.notificationService.getUnreadCount(getUnreadCountDto)
  }

  @Post('mark-read')
  async markNotificationRead(
    @Body() markNotificationReadDto: MarkNotificationReadDto,
  ) {
    return this.notificationService.markNotificationRead(
      markNotificationReadDto,
    )
  }

  @Post('batch-mark-read')
  async batchMarkNotificationRead(
    @Body() batchMarkNotificationReadDto: BatchMarkNotificationReadDto,
  ) {
    return this.notificationService.batchMarkNotificationRead(
      batchMarkNotificationReadDto,
    )
  }

  @Post('mark-all-read')
  async markAllNotificationRead(
    @Body() markAllNotificationReadDto: MarkAllNotificationReadDto,
  ) {
    return this.notificationService.markAllNotificationRead(
      markAllNotificationReadDto,
    )
  }

  @Post('delete')
  async deleteNotification(
    @Body() deleteNotificationDto: DeleteNotificationDto,
  ) {
    return this.notificationService.deleteNotification(deleteNotificationDto)
  }

  @Post('batch-delete')
  async batchDeleteNotification(
    @Body() batchDeleteNotificationDto: BatchDeleteNotificationDto,
  ) {
    return this.notificationService.batchDeleteNotification(
      batchDeleteNotificationDto,
    )
  }
}
