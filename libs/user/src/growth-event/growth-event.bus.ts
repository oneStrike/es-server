import type { UserGrowthEventBus } from './growth-event.types'
import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { UserGrowthEventDto } from './dto/growth-event.dto'

@Injectable()
export class LocalUserGrowthEventBus implements UserGrowthEventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: UserGrowthEventDto) {
    this.emitter.emit('user-growth-event', event)
  }

  subscribe(handler: (event: UserGrowthEventDto) => void | Promise<void>) {
    const wrapped = (event: UserGrowthEventDto) => {
      void Promise.resolve(handler(event))
    }
    this.emitter.on('user-growth-event', wrapped)
    return () => this.emitter.off('user-growth-event', wrapped)
  }
}
