import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const configurationRelations = defineRelationsPart(schema, (r) => ({
  appConfig: {
    updatedBy: r.one.adminUser({
      from: r.appConfig.updatedById,
      to: r.adminUser.id,
      alias: 'AppConfigUpdater',
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
