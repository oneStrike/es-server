import type { DomainEventDispatchRecord, DomainEventRecord } from '@libs/platform/modules/eventing'
import type { MessageChatService } from '../chat/chat.service'
import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { MESSAGE_CHAT_SERVICE_TOKEN } from '../chat/chat.constant'

/**
 * 聊天实时事件 consumer。
 * 只负责 fanout 聊天实时消息，不写 user_notification。
 */
@Injectable()
export class ChatRealtimeEventConsumer {
  private messageChatService?: MessageChatService

  constructor(private readonly moduleRef: ModuleRef) {}

  async consume(
    event: DomainEventRecord,
    _dispatch: DomainEventDispatchRecord,
  ) {
    if (event.eventKey !== 'chat.message.created') {
      return
    }

    await this.getMessageChatService().dispatchMessageCreatedDomainEvent(event)
  }

  private getMessageChatService() {
    if (!this.messageChatService) {
      this.messageChatService = this.moduleRef.get<MessageChatService>(
        MESSAGE_CHAT_SERVICE_TOKEN,
        { strict: false },
      )
    }
    if (!this.messageChatService) {
      throw new Error('MessageChatService is unavailable')
    }
    return this.messageChatService
  }
}
