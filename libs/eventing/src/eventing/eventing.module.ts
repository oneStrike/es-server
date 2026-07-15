import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { DomainEventDispatchService } from './domain-event-dispatch.service'
import { DomainEventPublisher } from './domain-event-publisher.service'

@Module({
  imports: [DrizzleModule],
  providers: [DomainEventPublisher, DomainEventDispatchService],
  exports: [DomainEventPublisher, DomainEventDispatchService],
})
export class EventingModule {}
