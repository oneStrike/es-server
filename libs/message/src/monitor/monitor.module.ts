import { Module } from '@nestjs/common'
import { MessageWsMonitorService } from './ws-monitor.service'

@Module({
  providers: [MessageWsMonitorService],
  exports: [MessageWsMonitorService],
})
export class MessageMonitorModule {}
