import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const adminRelations = defineRelationsPart(schema, (r) => ({
  adminUser: {
    tokens: r.many.adminUserToken(),
    roleAssignments: r.many.adminUserRole(),
    roles: r.many.adminRole({
      from: r.adminUser.id.through(r.adminUserRole.adminUserId),
      to: r.adminRole.id.through(r.adminUserRole.roleId),
    }),
    couponAdminGrantJobs: r.many.couponAdminGrantJob({
      from: r.adminUser.id,
      to: r.couponAdminGrantJob.operatorUserId,
      alias: 'CouponAdminGrantOperator',
    }),
    createdEmojiAssets: r.many.emojiAsset({
      from: r.adminUser.id,
      to: r.emojiAsset.createdById,
      alias: 'EmojiAssetCreatedBy',
    }),
    updatedEmojiAssets: r.many.emojiAsset({
      from: r.adminUser.id,
      to: r.emojiAsset.updatedById,
      alias: 'EmojiAssetUpdatedBy',
    }),
    createdEmojiPacks: r.many.emojiPack({
      from: r.adminUser.id,
      to: r.emojiPack.createdById,
      alias: 'EmojiPackCreatedBy',
    }),
    updatedEmojiPacks: r.many.emojiPack({
      from: r.adminUser.id,
      to: r.emojiPack.updatedById,
      alias: 'EmojiPackUpdatedBy',
    }),
    requestLogs: r.many.requestLog({
      from: r.adminUser.id,
      to: r.requestLog.userId,
    }),
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
  adminRole: {
    menuAssignments: r.many.adminRoleMenu(),
    menus: r.many.adminMenu({
      from: r.adminRole.id.through(r.adminRoleMenu.roleId),
      to: r.adminMenu.id.through(r.adminRoleMenu.menuId),
    }),
    permissionAssignments: r.many.adminRolePermission(),
    permissions: r.many.adminPermission({
      from: r.adminRole.id.through(r.adminRolePermission.roleId),
      to: r.adminPermission.id.through(r.adminRolePermission.permissionId),
    }),
    userAssignments: r.many.adminUserRole(),
    users: r.many.adminUser({
      from: r.adminRole.id.through(r.adminUserRole.roleId),
      to: r.adminUser.id.through(r.adminUserRole.adminUserId),
    }),
  },
  adminPermission: {
    roleAssignments: r.many.adminRolePermission(),
    roles: r.many.adminRole({
      from: r.adminPermission.id.through(r.adminRolePermission.permissionId),
      to: r.adminRole.id.through(r.adminRolePermission.roleId),
    }),
  },
  adminMenu: {
    parent: r.one.adminMenu({
      from: r.adminMenu.parentId,
      to: r.adminMenu.id,
      alias: 'AdminMenuParent',
    }),
    children: r.many.adminMenu({
      from: r.adminMenu.id,
      to: r.adminMenu.parentId,
      alias: 'AdminMenuParent',
    }),
    roleAssignments: r.many.adminRoleMenu(),
    roles: r.many.adminRole({
      from: r.adminMenu.id.through(r.adminRoleMenu.menuId),
      to: r.adminRole.id.through(r.adminRoleMenu.roleId),
    }),
  },
  adminRoleMenu: {
    role: r.one.adminRole({
      from: r.adminRoleMenu.roleId,
      to: r.adminRole.id,
    }),
    menu: r.one.adminMenu({
      from: r.adminRoleMenu.menuId,
      to: r.adminMenu.id,
    }),
  },
  adminRolePermission: {
    role: r.one.adminRole({
      from: r.adminRolePermission.roleId,
      to: r.adminRole.id,
    }),
    permission: r.one.adminPermission({
      from: r.adminRolePermission.permissionId,
      to: r.adminPermission.id,
    }),
  },
  adminUserRole: {
    user: r.one.adminUser({
      from: r.adminUserRole.adminUserId,
      to: r.adminUser.id,
    }),
    role: r.one.adminRole({
      from: r.adminUserRole.roleId,
      to: r.adminRole.id,
    }),
  },
  adminUserToken: {
    user: r.one.adminUser({
      from: r.adminUserToken.userId,
      to: r.adminUser.id,
    }),
  },
}))
