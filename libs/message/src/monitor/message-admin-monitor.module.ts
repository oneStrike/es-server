import { DrizzleModule } from '@db/core'
import { EventingModule } from '@libs/eventing/eventing/eventing.module'
import { Module } from '@nestjs/common'
import { MessageNotificationCoreModule } from '../notification/notification-core.module'
import { MessageChatInvestigationService } from './message-chat-investigation.service'
import { MessageMonitorService } from './message-monitor.service'

/**
 * 消息后台监控与聊天排查模块。
 *
 * 让后台入口通过消息领域服务访问监控数据，而不是自行组合数据库查询。
 */
@Module({
  imports: [DrizzleModule, EventingModule, MessageNotificationCoreModule],
  providers: [MessageChatInvestigationService, MessageMonitorService],
  exports: [MessageChatInvestigationService, MessageMonitorService],
})
export class MessageAdminMonitorModule {}
