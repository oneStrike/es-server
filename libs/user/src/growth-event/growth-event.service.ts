import { Inject, Injectable } from '@nestjs/common'
import { UserGrowthEventDto } from './dto/growth-event.dto'
import { UserGrowthEventBus } from './growth-event.bus'
import { USER_GROWTH_EVENT_BUS } from './growth-event.constant'

@Injectable()
export class UserGrowthEventService {
  constructor(
    @Inject(USER_GROWTH_EVENT_BUS)
    private readonly eventBus: UserGrowthEventBus,
  ) {}

  async handleEvent(event: UserGrowthEventDto) {
    await this.eventBus.publish(event)
  }
}
