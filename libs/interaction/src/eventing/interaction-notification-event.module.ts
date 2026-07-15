import { Module } from '@nestjs/common'
import { InteractionNotificationEventFactoryService } from './interaction-notification-event.factory'

/** 交互域通知事实工厂的唯一 provider owner。 */
@Module({
  providers: [InteractionNotificationEventFactoryService],
  exports: [InteractionNotificationEventFactoryService],
})
export class InteractionNotificationEventModule {}
