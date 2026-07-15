import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const observabilityRelations = defineRelationsPart(schema, (r) => ({
  requestLog: {
    user: r.one.adminUser({
      from: r.requestLog.userId,
      to: r.adminUser.id,
    }),
  },
}))
