import { MessageDispatchPageItemDto, MessageNotificationDeliveryItemDto, MessageWsMonitorSummaryDto, QueryMessageDispatchPageDto, QueryMessageWsMonitorDto, RetryMessageNotificationDeliveryDto } from '@libs/message/monitor/dto/message-monitor.dto';
import { QueryNotificationDeliveryPageDto } from '@libs/message/notification/dto/notification.dto';
import { ApiDoc, ApiPageDoc } from '@libs/platform/decorators/api-doc.decorator';
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
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
  @ApiAuditDoc({
    summary: '按 dispatch ID 重试失败的通知投递',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryNotificationDelivery(
    @Body() body: RetryMessageNotificationDeliveryDto,
  ) {
    return this.messageMonitorService.retryNotificationDeliveryByDispatchId(
      body.dispatchId,
    )
  }

  @Get('monitor/dispatch/page')
  @ApiPageDoc({
    summary: '分页查询通知 dispatch 调度结果',
    model: MessageDispatchPageItemDto,
  })
  async getNotificationDispatchPage(
    @Query() query: QueryMessageDispatchPageDto,
  ) {
    return this.messageMonitorService.getNotificationDispatchPage(query)
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
