import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  MessageNotificationDeliveryItemDto,
  MessageOutboxMonitorSummaryDto,
  MessageWsMonitorSummaryDto,
  QueryMessageNotificationDeliveryPageDto,
  QueryMessageOutboxMonitorDto,
  QueryMessageWsMonitorDto,
} from './dto/message-monitor.dto'
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
    @Query() query: QueryMessageNotificationDeliveryPageDto,
  ) {
    return this.messageMonitorService.getNotificationDeliveryPage(query)
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
