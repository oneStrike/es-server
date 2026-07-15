import { MessageModule as MessageCoreModule } from '@libs/message/message.module'
import { Module } from '@nestjs/common'
import { AppMessageChatUploadRuntimeModule } from './message-chat-upload-runtime.module'
import { MessageController } from './message.controller'

@Module({
  imports: [MessageCoreModule, AppMessageChatUploadRuntimeModule],
  controllers: [MessageController],
})
export class MessageModule {}
