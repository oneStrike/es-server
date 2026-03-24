import { MessageModule as MessageCoreModule } from '@libs/message/module'
import { Module } from '@nestjs/common'
import { MessageController } from './message.controller'

@Module({
  imports: [MessageCoreModule],
  controllers: [MessageController],
})
export class MessageModule {}
