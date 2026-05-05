import type { FastifyRequest } from 'fastify'
import { MessageChatUploadService } from '@libs/message/chat/chat-upload.service'
import { MessageChatService } from '@libs/message/chat/chat.service'
import {
  ChatConversationDto,
  ChatConversationMessagesResponseDto,
  OpenDirectConversationDto,
  QueryChatConversationMessagesDto,
} from '@libs/message/chat/dto/chat.dto'
import {
  InboxSummaryDto,
  InboxTimelineItemDto,
} from '@libs/message/inbox/dto/inbox.dto'
import { MessageInboxService } from '@libs/message/inbox/inbox.service'
import {
  NotificationUnreadDto,
  QueryUserNotificationListDto,
  UpdateUserNotificationPreferencesDto,
  UserNotificationDto,
  UserNotificationPreferenceListDto,
} from '@libs/message/notification/dto/notification.dto'
import { MessageNotificationPreferenceService } from '@libs/message/notification/notification-preference.service'
import { MessageNotificationService } from '@libs/message/notification/notification.service'
import { ApiDoc, ApiPageDoc, CurrentUser } from '@libs/platform/decorators'

import { IdDto, PageDto } from '@libs/platform/dto'
import { UploadResponseDto } from '@libs/platform/modules/upload/dto'

import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('消息')
@Controller('app/message')
export class MessageController {
  constructor(
    private readonly messageNotificationService: MessageNotificationService,
    private readonly messageNotificationPreferenceService: MessageNotificationPreferenceService,
    private readonly messageChatService: MessageChatService,
    private readonly messageInboxService: MessageInboxService,
    private readonly messageChatUploadService: MessageChatUploadService,
  ) {}

  @Get('notification/page')
  @ApiPageDoc({
    summary: '分页查询站内通知',
    model: UserNotificationDto,
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
    model: NotificationUnreadDto,
  })
  async unreadCount(@CurrentUser('sub') userId: number) {
    return this.messageNotificationService.getUnreadCount(userId)
  }

  @Get('notification/preference/list')
  @ApiDoc({
    summary: '获取通知偏好列表',
    model: UserNotificationPreferenceListDto,
  })
  async getNotificationPreferences(@CurrentUser('sub') userId: number) {
    return {
      list: await this.messageNotificationPreferenceService.getUserNotificationPreferenceList(
        userId,
      ),
    }
  }

  @Post('notification/preference/update')
  @ApiDoc({
    summary: '更新通知偏好',
    model: UserNotificationPreferenceListDto,
  })
  async updateNotificationPreferences(
    @Body() body: UpdateUserNotificationPreferencesDto,
    @CurrentUser('sub') userId: number,
  ) {
    return {
      list: await this.messageNotificationPreferenceService.updateUserNotificationPreferences(
        userId,
        body,
      ),
    }
  }

  @Post('notification/read')
  @ApiDoc({
    summary: '标记单条通知已读',
    model: Boolean,
  })
  async markRead(@Body() body: IdDto, @CurrentUser('sub') userId: number) {
    return this.messageNotificationService.markRead(userId, body.id)
  }

  @Post('notification/read-all')
  @ApiDoc({
    summary: '标记全部通知已读',
    model: Boolean,
  })
  async markAllRead(@CurrentUser('sub') userId: number) {
    return this.messageNotificationService.markAllRead(userId)
  }

  @Post('chat/direct/open')
  @ApiDoc({
    summary: '打开私聊会话',
    model: ChatConversationDto,
  })
  async openDirect(
    @Body() body: OpenDirectConversationDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.openDirectConversation(userId, body)
  }

  @Get('chat/conversation/page')
  @ApiPageDoc({
    summary: '分页查询会话列表',
    model: ChatConversationDto,
  })
  async conversationList(
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.getConversationList(userId, query)
  }

  @Get('chat/conversation/messages')
  @ApiDoc({
    summary: '查询会话消息',
    model: ChatConversationMessagesResponseDto,
  })
  async conversationMessages(
    @Query() query: QueryChatConversationMessagesDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageChatService.getConversationMessages(userId, query)
  }

  // 上传聊天媒体文件，scene 与 provider 兼容策略由消息域服务收口。
  @Post('chat/media/upload')
  @ApiDoc({
    summary: '上传聊天媒体文件',
    model: UploadResponseDto,
  })
  async uploadChatMedia(@Req() req: FastifyRequest) {
    return this.messageChatUploadService.uploadMedia(req)
  }

  @Get('inbox/summary')
  @ApiDoc({
    summary: '获取消息中心摘要',
    model: InboxSummaryDto,
  })
  async inboxSummary(@CurrentUser('sub') userId: number) {
    return this.messageInboxService.getSummary(userId)
  }

  @Get('inbox/timeline/page')
  @ApiPageDoc({
    summary: '分页查询消息中心时间线',
    model: InboxTimelineItemDto,
  })
  async inboxTimeline(
    @Query() query: PageDto,
    @CurrentUser('sub') userId: number,
  ) {
    return this.messageInboxService.getTimeline(userId, query)
  }
}
