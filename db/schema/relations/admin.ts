import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const adminRelations = defineRelationsPart(schema, r => ({
  adminUser: {
    tokens: r.many.adminUserToken(),
    createdTasks: r.many.task({ alias: 'TaskCreatedBy' }),
    updatedTasks: r.many.task({ alias: 'TaskUpdatedBy' }),
    updatedSystemConfigs: r.many.systemConfig({ alias: 'SystemConfigUpdater' }),
  },
  adminUserToken: {
    user: r.one.adminUser({
      from: r.adminUserToken.userId,
      to: r.adminUser.id,
    }),
  },
}))
