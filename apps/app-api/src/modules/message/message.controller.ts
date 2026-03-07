import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/base/decorators'
import { IdDto } from '@libs/base/dto'
import {
  BaseChatConversationDto,
  BaseChatMessageDto,
  BaseUserNotificationDto,
  InboxSummaryDto,
  InboxTimelineItemDto,
  MarkConversationReadDto,
  MessageChatService,
  MessageInboxService,
  MessageNotificationService,
  NotificationUnreadCountDto,
  OpenDirectConversationDto,
  QueryChatConversationListDto,
  QueryChatConversationMessagesDto,
  QueryInboxTimelineDto,
  QueryUserNotificationListDto,
  SendChatMessageDto,
} from '@libs/message'
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('消息中心')
@Controller('app/message')
export class MessageController {
  constructor(
    private readonly messageNotificationService: MessageNotificationService,
    private readonly messageChatService: MessageChatService,
    private readonly messageInboxService: MessageInboxService,
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

  @Post('chat/direct/open')
  @ApiDoc({
    summary: '打开私聊会话',
    model: BaseChatConversationDto,
  })
  async openDirect(
    @Body() body: OpenDirectConversationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.openDirectConversation(userId, body)
  }

  @Get('chat/conversation/list')
  @ApiPageDoc({
    summary: '分页查询会话列表',
    model: BaseChatConversationDto,
  })
  async conversationList(
    @Query() query: QueryChatConversationListDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.getConversationList(userId, query)
  }

  @Get('chat/conversation/messages')
  @ApiDoc({
    summary: '查询会话消息',
    model: BaseChatMessageDto,
  })
  async conversationMessages(
    @Query() query: QueryChatConversationMessagesDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.getConversationMessages(userId, query)
  }

  @Post('chat/conversation/send')
  @ApiDoc({
    summary: '发送会话消息',
    model: IdDto,
  })
  async sendMessage(
    @Body() body: SendChatMessageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.sendMessage(userId, body)
  }

  @Post('chat/conversation/read')
  @ApiDoc({
    summary: '标记会话已读到某条消息',
  })
  async markConversationRead(
    @Body() body: MarkConversationReadDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.markConversationRead(userId, body)
  }

  @Get('inbox/summary')
  @ApiDoc({
    summary: '获取消息中心摘要',
    model: InboxSummaryDto,
  })
  async inboxSummary(@CurrentUser('sub') userId: number) {
    return this.messageInboxService.getSummary(userId)
  }

  @Get('inbox/timeline')
  @ApiPageDoc({
    summary: '分页查询消息中心时间线',
    model: InboxTimelineItemDto,
  })
  async inboxTimeline(
    @Query() query: QueryInboxTimelineDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageInboxService.getTimeline(userId, query)
  }
}
