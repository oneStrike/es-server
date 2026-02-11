import { Module } from '@nestjs/common'
import { LocalUserGrowthEventBus } from './growth-event.bus'
import { USER_GROWTH_EVENT_BUS } from './growth-event.constant'
import { UserGrowthEventService } from './growth-event.service'

@Module({
  providers: [
    UserGrowthEventService,
    LocalUserGrowthEventBus,
    {
      provide: USER_GROWTH_EVENT_BUS,
      useExisting: LocalUserGrowthEventBus,
    },
  ],
  exports: [UserGrowthEventService, USER_GROWTH_EVENT_BUS, LocalUserGrowthEventBus],
})
export class UserGrowthEventModule {}
