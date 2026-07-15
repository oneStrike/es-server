import { UserModule } from '@libs/user/user.module'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MessageChatModule } from '../chat/chat.module'
import { MessageMonitorModule } from '../monitor/monitor.module'
import { MessageChatWsCommandService } from './notification-chat-ws-command.service'

/**
 * 原生 WS 聊天命令协议 owner。
 *
 * 只装配入站 chat 命令与其直接依赖；连接状态和出站 fanout 仍由 notification core owner 维护。
 */
@Module({
  imports: [ConfigModule, UserModule, MessageMonitorModule, MessageChatModule],
  providers: [MessageChatWsCommandService],
  exports: [MessageChatWsCommandService],
})
export class MessageChatWsCommandModule {}
