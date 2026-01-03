import { NotificationService } from '@app/forum/notification/notification.service'
import { JwtAuthGuard } from '@app/guards/jwt-auth.guard'
import {
  BatchDeleteNotificationDto,
  BatchMarkNotificationReadDto,
  DeleteNotificationDto,
  GetUnreadCountDto,
  MarkAllNotificationReadDto,
  MarkNotificationReadDto,
  QueryNotificationListDto,
} from '@libs/forum/notification/dto/notification.dto'
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('管理后台-论坛通知')
@Controller('admin/forum/notification')
export class AdminForumNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询通知列表' })
  async queryNotificationList(
    @Query() queryNotificationListDto: QueryNotificationListDto,
  ) {
    return this.notificationService.queryNotificationList(
      queryNotificationListDto,
    )
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户未读通知数量' })
  async getUnreadCount(@Query() getUnreadCountDto: GetUnreadCountDto) {
    return this.notificationService.getUnreadCount(getUnreadCountDto)
  }

  @Post('mark-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '标记通知已读' })
  async markNotificationRead(
    @Body() markNotificationReadDto: MarkNotificationReadDto,
  ) {
    return this.notificationService.markNotificationRead(
      markNotificationReadDto,
    )
  }

  @Post('batch-mark-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量标记通知已读' })
  async batchMarkNotificationRead(
    @Body() batchMarkNotificationReadDto: BatchMarkNotificationReadDto,
  ) {
    return this.notificationService.batchMarkNotificationRead(
      batchMarkNotificationReadDto,
    )
  }

  @Post('mark-all-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '标记用户所有通知已读' })
  async markAllNotificationRead(
    @Body() markAllNotificationReadDto: MarkAllNotificationReadDto,
  ) {
    return this.notificationService.markAllNotificationRead(
      markAllNotificationReadDto,
    )
  }

  @Post('delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除通知' })
  async deleteNotification(
    @Body() deleteNotificationDto: DeleteNotificationDto,
  ) {
    return this.notificationService.deleteNotification(deleteNotificationDto)
  }

  @Post('batch-delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量删除通知' })
  async batchDeleteNotification(
    @Body() batchDeleteNotificationDto: BatchDeleteNotificationDto,
  ) {
    return this.notificationService.batchDeleteNotification(
      batchDeleteNotificationDto,
    )
  }
}
