import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema/index'

export const systemRelations = defineRelationsPart(schema, r => ({
  systemDictionary: {
    dictionaryItems: r.many.systemDictionaryItem(),
  },
  systemDictionaryItem: {
    parentDictionary: r.one.systemDictionary({
      from: r.systemDictionaryItem.dictionaryCode,
      to: r.systemDictionary.code,
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
