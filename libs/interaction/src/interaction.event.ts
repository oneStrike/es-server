import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { InteractionActionType, InteractionTargetType } from './interaction.constant'

export interface InteractionEvent {
  actionType: InteractionActionType
  targetType: InteractionTargetType
  targetId: number
  userId: number
  timestamp: Date
  extraData?: Record<string, unknown>
}

export type InteractionEventHandler = (event: InteractionEvent) => Promise<void> | void

@Injectable()
export class InteractionEventEmitter implements OnModuleDestroy {
  private handlers: Map<InteractionActionType, Set<InteractionEventHandler>> = new Map()

  onModuleDestroy() {
    this.handlers.clear()
  }

  on(actionType: InteractionActionType, handler: InteractionEventHandler): void {
    if (!this.handlers.has(actionType)) {
      this.handlers.set(actionType, new Set())
    }
    this.handlers.get(actionType)!.add(handler)
  }

  off(actionType: InteractionActionType, handler: InteractionEventHandler): void {
    this.handlers.get(actionType)?.delete(handler)
  }

  async emit(event: InteractionEvent): Promise<void> {
    const handlers = this.handlers.get(event.actionType)
    if (!handlers) {
      return
    }

    await Promise.all(
      Array.from(handlers).map(async handler => handler(event))
    )
  }
}
