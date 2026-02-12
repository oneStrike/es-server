import { UserGrowthEventModule } from '@libs/user/growth-event'
import { Module } from '@nestjs/common'
import { UserGrowthEventController } from './event.controller'

@Module({
  imports: [UserGrowthEventModule],
  controllers: [UserGrowthEventController],
  providers: [],
  exports: [],
})
export class EventModule {}
