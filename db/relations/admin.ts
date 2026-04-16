import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const adminRelations = defineRelationsPart(schema, (r) => ({
  adminUser: {
    tokens: r.many.adminUserToken(),
    createdTasks: r.many.task({
      from: r.adminUser.id,
      to: r.task.createdById,
      alias: 'TaskCreatedBy',
    }),
    updatedTasks: r.many.task({
      from: r.adminUser.id,
      to: r.task.updatedById,
      alias: 'TaskUpdatedBy',
    }),
    updatedAppConfigs: r.many.appConfig({
      from: r.adminUser.id,
      to: r.appConfig.updatedById,
      alias: 'AppConfigUpdater',
    }),
    updatedSystemConfigs: r.many.systemConfig({
      from: r.adminUser.id,
      to: r.systemConfig.updatedById,
      alias: 'SystemConfigUpdater',
    }),
  },
  adminUserToken: {
    user: r.one.adminUser({
      from: r.adminUserToken.userId,
      to: r.adminUser.id,
    }),
  },
}))
