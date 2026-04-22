import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const adminRelations = defineRelationsPart(schema, (r) => ({
  adminUser: {
    tokens: r.many.adminUserToken(),
    createdTasks: r.many.taskDefinition({
      from: r.adminUser.id,
      to: r.taskDefinition.createdById,
      alias: 'TaskDefinitionCreatedBy',
    }),
    updatedTasks: r.many.taskDefinition({
      from: r.adminUser.id,
      to: r.taskDefinition.updatedById,
      alias: 'TaskDefinitionUpdatedBy',
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
