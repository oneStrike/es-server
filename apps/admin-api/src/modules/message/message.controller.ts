import {
  MessageNotificationDeliveryItemDto,
  MessageOutboxMonitorSummaryDto,
  MessageWsMonitorSummaryDto,
  QueryMessageOutboxMonitorDto,
  QueryMessageWsMonitorDto,
  RetryMessageNotificationDeliveryDto,
} from '@libs/message/monitor'
import { QueryNotificationDeliveryPageDto } from '@libs/message/notification'
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MessageMonitorService } from './message-monitor.service'

@ApiTags('消息中心/监控')
@Controller('admin/message')
export class MessageController {
  constructor(private readonly messageMonitorService: MessageMonitorService) {}

  @Get('monitor/delivery/page')
  @ApiPageDoc({
    summary: '分页查询通知投递结果',
    model: MessageNotificationDeliveryItemDto,
  })
  async getNotificationDeliveryPage(
    @Query() query: QueryNotificationDeliveryPageDto,
  ) {
    return this.messageMonitorService.getNotificationDeliveryPage(query)
  }

  @Post('monitor/delivery/retry')
  @ApiDoc({
    summary: '按 bizKey 重试失败的通知投递',
    model: Boolean,
  })
  async retryNotificationDelivery(
    @Body() body: RetryMessageNotificationDeliveryDto,
  ) {
    return this.messageMonitorService.retryNotificationDeliveryByBizKey(
      body.bizKey,
    )
  }

  @Get('monitor/outbox/summary')
  @ApiDoc({
    summary: '获取消息 outbox 监控摘要',
    model: MessageOutboxMonitorSummaryDto,
  })
  async getOutboxMonitorSummary(@Query() query: QueryMessageOutboxMonitorDto) {
    return this.messageMonitorService.getOutboxMonitorSummary(query)
  }

  @Get('monitor/ws/summary')
  @ApiDoc({
    summary: '获取消息 WS 监控摘要',
    model: MessageWsMonitorSummaryDto,
  })
  async getWsMonitorSummary(@Query() query: QueryMessageWsMonitorDto) {
    return this.messageMonitorService.getWsMonitorSummary(query)
  }
}
