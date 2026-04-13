import { Global, Module } from '@nestjs/common'
import { DomainEventDispatchService } from './domain-event-dispatch.service'
import { DomainEventPublisher } from './domain-event-publisher.service'

@Global()
@Module({
  providers: [DomainEventPublisher, DomainEventDispatchService],
  exports: [DomainEventPublisher, DomainEventDispatchService],
})
export class EventingModule {}
