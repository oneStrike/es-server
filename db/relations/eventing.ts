import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const eventingRelations = defineRelationsPart(schema, (r) => ({
  domainEvent: {
    dispatches: r.many.domainEventDispatch(),
    notificationDeliveries: r.many.notificationDelivery({
      from: r.domainEvent.id,
      to: r.notificationDelivery.eventId,
    }),
  },
  domainEventDispatch: {
    event: r.one.domainEvent({
      from: r.domainEventDispatch.eventId,
      to: r.domainEvent.id,
    }),
    notificationDelivery: r.one.notificationDelivery({
      from: r.domainEventDispatch.id,
      to: r.notificationDelivery.dispatchId,
    }),
  },
}))
