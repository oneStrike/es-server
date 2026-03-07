import { Module } from '@nestjs/common'
import { MessageMonitorService } from './message-monitor.service'
import { MessageController } from './message.controller'

@Module({
  controllers: [MessageController],
  providers: [MessageMonitorService],
})
export class MessageModule {}
