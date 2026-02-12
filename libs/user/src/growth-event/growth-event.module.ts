import { Module } from '@nestjs/common'
import { UserGrowthEventAntifraudService } from './growth-event.antifraud.service'
import { UserGrowthEventAuditCronService } from './growth-event.audit-cron.service'
import { UserGrowthEventAuditService } from './growth-event.audit.service'
import { LocalUserGrowthEventBus } from './growth-event.bus'
import { USER_GROWTH_EVENT_BUS } from './growth-event.constant'
import { UserGrowthEventConsumer } from './growth-event.consumer'
import { UserGrowthEventService } from './growth-event.service'

@Module({
  providers: [
    UserGrowthEventService,
    LocalUserGrowthEventBus,
    UserGrowthEventAuditService,
    UserGrowthEventAuditCronService,
    UserGrowthEventAntifraudService,
    UserGrowthEventConsumer,
    {
      provide: USER_GROWTH_EVENT_BUS,
      useExisting: LocalUserGrowthEventBus,
    },
  ],
  exports: [
    UserGrowthEventService,
    UserGrowthEventAuditService,
    USER_GROWTH_EVENT_BUS,
    LocalUserGrowthEventBus,
  ],
})
export class UserGrowthEventModule {}
