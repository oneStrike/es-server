import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const systemRelations = defineRelationsPart(schema, r => ({
  domainEvent: {
    dispatches: r.many.domainEventDispatch(),
  },
  domainEventDispatch: {
    event: r.one.domainEvent({
      from: r.domainEventDispatch.eventId,
      to: r.domainEvent.id,
    }),
  },
  dictionary: {
    dictionaryItems: r.many.dictionaryItem(),
  },
  dictionaryItem: {
    parentDictionary: r.one.dictionary({
      from: r.dictionaryItem.dictionaryCode,
      to: r.dictionary.code,
    }),
  },
  systemConfig: {
    updatedBy: r.one.adminUser({
      from: r.systemConfig.updatedById,
      to: r.adminUser.id,
      alias: 'SystemConfigUpdater',
    }),
  },
}))
