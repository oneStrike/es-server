import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const growthRelations = defineRelationsPart(schema, (r) => ({
  growthAuditLog: {
    user: r.one.appUser({ from: r.growthAuditLog.userId, to: r.appUser.id }),
  },
  growthLedgerRecord: {
    user: r.one.appUser({
      from: r.growthLedgerRecord.userId,
      to: r.appUser.id,
    }),
  },
  growthRewardSettlement: {
    user: r.one.appUser({
      from: r.growthRewardSettlement.userId,
      to: r.appUser.id,
    }),
    taskInstances: r.many.taskInstance({
      from: r.growthRewardSettlement.id,
      to: r.taskInstance.rewardSettlementId,
    }),
  },
  growthRuleUsageCounter: {
    user: r.one.appUser({
      from: r.growthRuleUsageCounter.userId,
      to: r.appUser.id,
    }),
  },
  checkInConfig: {
    updatedBy: r.one.adminUser({
      from: r.checkInConfig.updatedById,
      to: r.adminUser.id,
      alias: 'CheckInConfigUpdatedBy',
    }),
  },
  checkInStreakRule: {
    updatedBy: r.one.adminUser({
      from: r.checkInStreakRule.updatedById,
      to: r.adminUser.id,
      alias: 'CheckInStreakRuleUpdatedBy',
    }),
    rewardItems: r.many.checkInStreakRuleRewardItem(),
    grants: r.many.checkInStreakGrant({
      from: r.checkInStreakRule.id,
      to: r.checkInStreakGrant.ruleId,
      alias: 'StreakRuleGrants',
    }),
  },
  checkInStreakRuleRewardItem: {
    rule: r.one.checkInStreakRule({
      from: r.checkInStreakRuleRewardItem.ruleId,
      to: r.checkInStreakRule.id,
    }),
  },
  checkInStreakProgress: {
    user: r.one.appUser({
      from: r.checkInStreakProgress.userId,
      to: r.appUser.id,
    }),
  },
  checkInMakeupFact: {
    user: r.one.appUser({
      from: r.checkInMakeupFact.userId,
      to: r.appUser.id,
    }),
    synchronizedAccounts: r.many.checkInMakeupAccount({
      from: r.checkInMakeupFact.id,
      to: r.checkInMakeupAccount.lastSyncedFactId,
    }),
  },
  checkInMakeupAccount: {
    user: r.one.appUser({
      from: r.checkInMakeupAccount.userId,
      to: r.appUser.id,
    }),
    lastSyncedFact: r.one.checkInMakeupFact({
      from: r.checkInMakeupAccount.lastSyncedFactId,
      to: r.checkInMakeupFact.id,
    }),
  },
  checkInRecord: {
    user: r.one.appUser({
      from: r.checkInRecord.userId,
      to: r.appUser.id,
    }),
    rewardSettlement: r.one.growthRewardSettlement({
      from: r.checkInRecord.rewardSettlementId,
      to: r.growthRewardSettlement.id,
    }),
  },
  checkInStreakGrant: {
    user: r.one.appUser({
      from: r.checkInStreakGrant.userId,
      to: r.appUser.id,
    }),
    rule: r.one.checkInStreakRule({
      from: r.checkInStreakGrant.ruleId,
      to: r.checkInStreakRule.id,
      alias: 'StreakGrantRule',
    }),
    rewardItems: r.many.checkInStreakGrantRewardItem(),
    rewardSettlement: r.one.growthRewardSettlement({
      from: r.checkInStreakGrant.rewardSettlementId,
      to: r.growthRewardSettlement.id,
    }),
  },
  checkInStreakGrantRewardItem: {
    grant: r.one.checkInStreakGrant({
      from: r.checkInStreakGrantRewardItem.grantId,
      to: r.checkInStreakGrant.id,
    }),
  },
  taskDefinition: {
    steps: r.many.taskStep(),
    instances: r.many.taskInstance(),
    notificationDeliveries: r.many.notificationDelivery({
      from: r.taskDefinition.id,
      to: r.notificationDelivery.taskId,
    }),
    createdBy: r.one.adminUser({
      from: r.taskDefinition.createdById,
      to: r.adminUser.id,
      alias: 'TaskDefinitionCreatedBy',
    }),
    updatedBy: r.one.adminUser({
      from: r.taskDefinition.updatedById,
      to: r.adminUser.id,
      alias: 'TaskDefinitionUpdatedBy',
    }),
  },
  taskStep: {
    task: r.one.taskDefinition({
      from: r.taskStep.taskId,
      to: r.taskDefinition.id,
    }),
    instanceSteps: r.many.taskInstanceStep(),
    uniqueFacts: r.many.taskStepUniqueFact(),
    eventLogs: r.many.taskEventLog(),
  },
  taskInstance: {
    task: r.one.taskDefinition({
      from: r.taskInstance.taskId,
      to: r.taskDefinition.id,
    }),
    user: r.one.appUser({
      from: r.taskInstance.userId,
      to: r.appUser.id,
    }),
    rewardSettlement: r.one.growthRewardSettlement({
      from: r.taskInstance.rewardSettlementId,
      to: r.growthRewardSettlement.id,
    }),
    steps: r.many.taskInstanceStep(),
    eventLogs: r.many.taskEventLog(),
    notificationDeliveries: r.many.notificationDelivery({
      from: r.taskInstance.id,
      to: r.notificationDelivery.instanceId,
    }),
  },
  taskInstanceStep: {
    instance: r.one.taskInstance({
      from: r.taskInstanceStep.instanceId,
      to: r.taskInstance.id,
    }),
    step: r.one.taskStep({
      from: r.taskInstanceStep.stepId,
      to: r.taskStep.id,
    }),
    eventLogs: r.many.taskEventLog(),
  },
  taskStepUniqueFact: {
    task: r.one.taskDefinition({
      from: r.taskStepUniqueFact.taskId,
      to: r.taskDefinition.id,
    }),
    step: r.one.taskStep({
      from: r.taskStepUniqueFact.stepId,
      to: r.taskStep.id,
    }),
    user: r.one.appUser({
      from: r.taskStepUniqueFact.userId,
      to: r.appUser.id,
    }),
  },
  taskEventLog: {
    task: r.one.taskDefinition({
      from: r.taskEventLog.taskId,
      to: r.taskDefinition.id,
    }),
    step: r.one.taskStep({
      from: r.taskEventLog.stepId,
      to: r.taskStep.id,
    }),
    instance: r.one.taskInstance({
      from: r.taskEventLog.instanceId,
      to: r.taskInstance.id,
    }),
    instanceStep: r.one.taskInstanceStep({
      from: r.taskEventLog.instanceStepId,
      to: r.taskInstanceStep.id,
    }),
    user: r.one.appUser({
      from: r.taskEventLog.userId,
      to: r.appUser.id,
    }),
  },
  userBadge: {
    assignments: r.many.userBadgeAssignment(),
    users: r.many.appUser({
      from: r.userBadge.id.through(r.userBadgeAssignment.badgeId),
      to: r.appUser.id.through(r.userBadgeAssignment.userId),
    }),
  },
  userBadgeAssignment: {
    badge: r.one.userBadge({
      from: r.userBadgeAssignment.badgeId,
      to: r.userBadge.id,
    }),
    user: r.one.appUser({
      from: r.userBadgeAssignment.userId,
      to: r.appUser.id,
    }),
  },
  taskEventFailure: {
    user: r.one.appUser({
      from: r.taskEventFailure.userId,
      to: r.appUser.id,
    }),
  },
  userLevelRule: {
    users: r.many.appUser({
      from: r.userLevelRule.id,
      to: r.appUser.levelId,
    }),
    sections: r.many.forumSection({
      from: r.userLevelRule.id,
      to: r.forumSection.userLevelRuleId,
    }),
    chaptersAsReadLevel: r.many.workChapter({
      from: r.userLevelRule.id,
      to: r.workChapter.requiredViewLevelId,
      alias: 'ChapterReadLevel',
    }),
    worksAsViewLevel: r.many.work({
      from: r.userLevelRule.id,
      to: r.work.requiredViewLevelId,
      alias: 'WorkViewLevel',
    }),
  },
}))
