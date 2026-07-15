import type {
  DomainEventDispatchRecord,
  DomainEventRecord,
} from '@libs/eventing/eventing/domain-event.type'
import { Injectable } from '@nestjs/common'
import { MessageChatService } from './chat.service'

/**
 * 聊天实时事件 consumer。
 * 只负责 fanout 聊天实时消息，不写 user_notification。
 */
@Injectable()
export class ChatRealtimeEventConsumer {
  constructor(private readonly messageChatService: MessageChatService) {}

  async consume(
    event: DomainEventRecord,
    _dispatch: DomainEventDispatchRecord,
  ) {
    if (event.eventKey !== 'chat.message.created') {
      return
    }

    await this.messageChatService.dispatchMessageCreatedDomainEvent(event)
  }
}
