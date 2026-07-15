import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { MessageWsMonitorService } from './ws-monitor.service'

@Module({
  imports: [DrizzleModule],
  providers: [MessageWsMonitorService],
  exports: [MessageWsMonitorService],
})
export class MessageMonitorModule {}
