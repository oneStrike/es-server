import {
  AdminChatConversationPageItemDto,
  AdminChatMessagePageItemDto,
  MessageDispatchPageItemDto,
  MessageMonitorSummaryDto,
  MessageNotificationDeliveryItemDto,
  MessageWsMonitorSummaryDto,
  QueryAdminChatConversationPageDto,
  QueryAdminChatMessagePageDto,
  QueryMessageDispatchPageDto,
  QueryMessageWsMonitorDto,
  RetryMessageNotificationDeliveryDto,
} from '@libs/message/monitor/dto/message-monitor.dto'
import { QueryNotificationDeliveryPageDto } from '@libs/message/notification/dto/notification.dto'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'
import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminPermission } from '../../common/decorators/admin-permission.decorator'
import { ApiAuditDoc } from '../../common/decorators/api-audit-doc.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import { MessageChatInvestigationService } from './message-chat-investigation.service'
import { MessageMonitorService } from './message-monitor.service'

@ApiTags('消息中心/监控')
@Controller('admin/message')
export class MessageController {
  constructor(
    private readonly messageMonitorService: MessageMonitorService,
    private readonly messageChatInvestigationService: MessageChatInvestigationService,
  ) {}

  @Get('monitor/delivery/page')
  @AdminPermission({
    code: 'message:monitor:delivery:page',
    name: '分页查询通知投递结果',
    groupCode: 'message',
  })
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
  @AdminPermission({
    code: 'message:monitor:delivery:retry',
    name: '按投递记录重试失败的通知投递',
    groupCode: 'message',
  })
  @ApiAuditDoc({
    summary: '按投递记录重试失败的通知投递',
    model: Boolean,
    audit: {
      actionType: AuditActionTypeEnum.UPDATE,
    },
  })
  async retryNotificationDelivery(
    @Body() body: RetryMessageNotificationDeliveryDto,
    @CurrentUser('sub') adminUserId: number,
  ) {
    return this.messageMonitorService.retryNotificationDelivery(
      adminUserId,
      body,
    )
  }

  @Get('monitor/summary')
  @AdminPermission({
    code: 'message:monitor:summary',
    name: '获取消息运行摘要',
    groupCode: 'message',
  })
  @ApiDoc({
    summary: '获取消息运行摘要',
    model: MessageMonitorSummaryDto,
  })
  async getMonitorSummary() {
    return this.messageMonitorService.getMonitorSummary()
  }

  @Get('monitor/dispatch/page')
  @AdminPermission({
    code: 'message:monitor:dispatch:page',
    name: '分页查询通知 dispatch 调度结果',
    groupCode: 'message',
  })
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
  @AdminPermission({
    code: 'message:monitor:ws:summary',
    name: '获取消息 WS 监控摘要',
    groupCode: 'message',
  })
  @ApiDoc({
    summary: '获取消息 WS 监控摘要',
    model: MessageWsMonitorSummaryDto,
  })
  async getWsMonitorSummary(@Query() query: QueryMessageWsMonitorDto) {
    return this.messageMonitorService.getWsMonitorSummary(query)
  }

  @Get('chat/conversation/page')
  @AdminPermission({
    code: 'message:chat:conversation:page',
    name: '分页查询聊天会话排查列表',
    groupCode: 'message',
  })
  @ApiPageDoc({
    summary: '分页查询聊天会话排查列表',
    model: AdminChatConversationPageItemDto,
  })
  @Audit({
    actionType: AuditActionTypeEnum.EXPORT,
    content: '分页查询聊天会话排查列表',
  })
  async getChatConversationPage(
    @CurrentUser('sub') adminUserId: number,
    @Query() query: QueryAdminChatConversationPageDto,
  ) {
    return this.messageChatInvestigationService.getConversationPage(
      adminUserId,
      query,
    )
  }

  @Get('chat/message/page')
  @AdminPermission({
    code: 'message:chat:message:page',
    name: '分页查询聊天消息排查列表',
    groupCode: 'message',
  })
  @ApiPageDoc({
    summary: '分页查询聊天消息排查列表',
    model: AdminChatMessagePageItemDto,
  })
  @Audit({
    actionType: AuditActionTypeEnum.EXPORT,
    content: '分页查询聊天消息排查列表',
  })
  async getChatMessagePage(
    @CurrentUser('sub') adminUserId: number,
    @Query() query: QueryAdminChatMessagePageDto,
  ) {
    return this.messageChatInvestigationService.getMessagePage(
      adminUserId,
      query,
    )
  }
}
