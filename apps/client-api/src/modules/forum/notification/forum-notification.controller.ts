import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '@app/guards/jwt-auth.guard'
import { NotificationService } from '@app/forum/notification/notification.service'
import {
  QueryNotificationListDto,
  MarkNotificationReadDto,
  BatchMarkNotificationReadDto,
  MarkAllNotificationReadDto,
  DeleteNotificationDto,
  BatchDeleteNotificationDto,
  GetUnreadCountDto,
} from '@app/forum/notification/dto/notification.dto'

@ApiTags('客户端-论坛通知')
@Controller('client/forum/notification')
export class ClientForumNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询我的通知列表' })
  async queryMyNotificationList(
    @Query() queryNotificationListDto: QueryNotificationListDto,
    @Query('userId') userId: number,
  ) {
    return this.notificationService.queryUserNotificationList(userId, queryNotificationListDto)
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的未读通知数量' })
  async getMyUnreadCount(@Query('userId') userId: number) {
    return this.notificationService.getUserUnreadCount(userId)
  }

  @Post('mark-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '标记通知已读' })
  async markNotificationRead(@Body() markNotificationReadDto: MarkNotificationReadDto) {
    return this.notificationService.markNotificationRead(markNotificationReadDto)
  }

  @Post('batch-mark-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量标记通知已读' })
  async batchMarkNotificationRead(@Body() batchMarkNotificationReadDto: BatchMarkNotificationReadDto) {
    return this.notificationService.batchMarkNotificationRead(batchMarkNotificationReadDto)
  }

  @Post('mark-all-read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '标记所有通知已读' })
  async markAllNotificationRead(@Body() markAllNotificationReadDto: MarkAllNotificationReadDto) {
    return this.notificationService.markAllNotificationRead(markAllNotificationReadDto)
  }

  @Post('delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除通知' })
  async deleteNotification(@Body() deleteNotificationDto: DeleteNotificationDto) {
    return this.notificationService.deleteNotification(deleteNotificationDto)
  }

  @Post('batch-delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量删除通知' })
  async batchDeleteNotification(@Body() batchDeleteNotificationDto: BatchDeleteNotificationDto) {
    return this.notificationService.batchDeleteNotification(batchDeleteNotificationDto)
  }
}
