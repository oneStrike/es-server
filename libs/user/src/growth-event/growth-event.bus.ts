import { EventEmitter } from 'node:events'
import { Injectable } from '@nestjs/common'
import { UserGrowthEventDto } from './dto/growth-event.dto'

export interface UserGrowthEventBus {
  publish: (event: UserGrowthEventDto) => Promise<void>
  subscribe: (
    handler: (event: UserGrowthEventDto) => void | Promise<void>,
  ) => () => void
}

@Injectable()
export class LocalUserGrowthEventBus implements UserGrowthEventBus {
  private readonly emitter = new EventEmitter()

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
