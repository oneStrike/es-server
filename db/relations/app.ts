import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const appRelations = defineRelationsPart(schema, (r) => ({
  appAgreement: {
    agreementLogs: r.many.appAgreementLog(),
    membershipPageConfigs: r.many.membershipPageConfig({
      from: r.appAgreement.id.through(
        r.membershipPageConfigAgreement.agreementId,
      ),
      to: r.membershipPageConfig.id.through(
        r.membershipPageConfigAgreement.pageConfigId,
      ),
    }),
  },
  appAgreementLog: {
    agreement: r.one.appAgreement({
      from: r.appAgreementLog.agreementId,
      to: r.appAgreement.id,
    }),
    user: r.one.appUser({ from: r.appAgreementLog.userId, to: r.appUser.id }),
  },
  appAnnouncement: {
    appPage: r.one.appPage({
      from: r.appAnnouncement.pageId,
      to: r.appPage.id,
      alias: 'announcements',
    }),
    announcementReads: r.many.appAnnouncementRead(),
  },
  appAnnouncementRead: {
    announcement: r.one.appAnnouncement({
      from: r.appAnnouncementRead.announcementId,
      to: r.appAnnouncement.id,
    }),
    user: r.one.appUser({
      from: r.appAnnouncementRead.userId,
      to: r.appUser.id,
    }),
  },
  appConfig: {
    updatedBy: r.one.adminUser({
      from: r.appConfig.updatedById,
      to: r.adminUser.id,
      alias: 'AppConfigUpdater',
    }),
  },
  appUpdateRelease: {
    createdBy: r.one.adminUser({
      from: r.appUpdateRelease.createdById,
      to: r.adminUser.id,
      alias: 'AppUpdateReleaseCreatedBy',
    }),
    updatedBy: r.one.adminUser({
      from: r.appUpdateRelease.updatedById,
      to: r.adminUser.id,
      alias: 'AppUpdateReleaseUpdatedBy',
    }),
  },
  appPage: {
    announcements: r.many.appAnnouncement({
      from: r.appPage.id,
      to: r.appAnnouncement.pageId,
      alias: 'announcements',
    }),
  },
  appUser: {
    agreementLogs: r.many.appAgreementLog(),
    level: r.one.userLevelRule({
      from: r.appUser.levelId,
      to: r.userLevelRule.id,
    }),
    counts: r.one.appUserCount({
      from: r.appUser.id,
      to: r.appUserCount.userId,
    }),
    announcementReads: r.many.appAnnouncementRead(),
    tokens: r.many.appUserToken(),
    forumTopics: r.many.forumTopic({
      from: r.appUser.id,
      to: r.forumTopic.userId,
      alias: 'UserTopics',
    }),
    lastCommentTopics: r.many.forumTopic({
      from: r.appUser.id,
      to: r.forumTopic.lastCommentUserId,
      alias: 'UserLastCommentTopics',
    }),
    receivedNotifications: r.many.userNotification({
      from: r.appUser.id,
      to: r.userNotification.receiverUserId,
      alias: 'UserNotificationReceiver',
    }),
    notificationPreferences: r.many.notificationPreference({
      from: r.appUser.id,
      to: r.notificationPreference.userId,
      alias: 'NotificationPreferenceUser',
    }),
    notificationDeliveries: r.many.notificationDelivery({
      from: r.appUser.id,
      to: r.notificationDelivery.receiverUserId,
    }),
    triggeredNotifications: r.many.userNotification({
      from: r.appUser.id,
      to: r.userNotification.actorUserId,
      alias: 'UserNotificationActor',
    }),
    chatConversationMembers: r.many.chatConversationMember({
      from: r.appUser.id,
      to: r.chatConversationMember.userId,
      alias: 'ChatConversationMemberUser',
    }),
    chatConversations: r.many.chatConversation({
      from: r.appUser.id.through(r.chatConversationMember.userId),
      to: r.chatConversation.id.through(
        r.chatConversationMember.conversationId,
      ),
      alias: 'ChatConversationParticipants',
    }),
    sentChatMessages: r.many.chatMessage({
      from: r.appUser.id,
      to: r.chatMessage.senderId,
      alias: 'ChatMessageSender',
    }),
    lastSentConversations: r.many.chatConversation({
      from: r.appUser.id,
      to: r.chatConversation.lastSenderId,
      alias: 'ChatConversationLastSender',
    }),
    moderatorApplications: r.many.forumModeratorApplication({
      from: r.appUser.id,
      to: r.forumModeratorApplication.applicantId,
      alias: 'ModeratorApplicant',
    }),
    auditedApplications: r.many.forumModeratorApplication({
      from: r.appUser.id,
      to: r.forumModeratorApplication.auditById,
      alias: 'ModeratorAuditor',
    }),
    moderator: r.one.forumModerator({
      from: r.appUser.id,
      to: r.forumModerator.userId,
    }),
    forumActionLogs: r.many.forumUserActionLog({
      from: r.appUser.id,
      to: r.forumUserActionLog.userId,
    }),
    badgeAssignments: r.many.userBadgeAssignment(),
    badges: r.many.userBadge({
      from: r.appUser.id.through(r.userBadgeAssignment.userId),
      to: r.userBadge.id.through(r.userBadgeAssignment.badgeId),
    }),
    growthLedgerRecords: r.many.growthLedgerRecord(),
    growthRewardSettlements: r.many.growthRewardSettlement(),
    growthAuditLogs: r.many.growthAuditLog(),
    assetBalances: r.many.userAssetBalance(),
    growthRuleUsageCounters: r.many.growthRuleUsageCounter(),
    checkInMakeupFacts: r.many.checkInMakeupFact(),
    checkInMakeupAccounts: r.many.checkInMakeupAccount(),
    checkInStreakProgresses: r.many.checkInStreakProgress(),
    checkInStreakGrants: r.many.checkInStreakGrant(),
    checkInRecords: r.many.checkInRecord(),
    taskInstances: r.many.taskInstance(),
    taskStepUniqueFacts: r.many.taskStepUniqueFact(),
    taskEventLogs: r.many.taskEventLog(),
    userLikes: r.many.userLike(),
    userFavorites: r.many.userFavorite(),
    browseLogs: r.many.userBrowseLog(),
    workReadingStates: r.many.userWorkReadingState(),
    userComments: r.many.userComment(),
    userReports: r.many.userReport({
      from: r.appUser.id,
      to: r.userReport.reporterId,
      alias: 'UserReportReporter',
    }),
    handledUserReports: r.many.userReport({
      from: r.appUser.id,
      to: r.userReport.handlerId,
      alias: 'UserReportHandler',
    }),
    userDownloadRecords: r.many.userDownloadRecord(),
    userPurchaseRecords: r.many.userPurchaseRecord(),
    contentEntitlements: r.many.userContentEntitlement(),
    membershipSubscriptions: r.many.userMembershipSubscription(),
    membershipAutoRenewAgreements: r.many.membershipAutoRenewAgreement(),
    membershipBenefitClaimRecords: r.many.membershipBenefitClaimRecord(),
    paymentOrders: r.many.paymentOrder(),
    userCouponInstances: r.many.userCouponInstance(),
    couponRedemptionRecords: r.many.couponRedemptionRecord(),
    adRewardRecords: r.many.adRewardRecord(),
    emojiRecentUsageRecords: r.many.emojiRecentUsage(),
  },
  emojiAsset: {
    pack: r.one.emojiPack({
      from: r.emojiAsset.packId,
      to: r.emojiPack.id,
    }),
    recentUsageRecords: r.many.emojiRecentUsage(),
  },
  emojiPack: {
    assets: r.many.emojiAsset(),
  },
  emojiRecentUsage: {
    user: r.one.appUser({
      from: r.emojiRecentUsage.userId,
      to: r.appUser.id,
    }),
    emojiAsset: r.one.emojiAsset({
      from: r.emojiRecentUsage.emojiAssetId,
      to: r.emojiAsset.id,
    }),
  },
  appUserCount: {
    user: r.one.appUser({
      from: r.appUserCount.userId,
      to: r.appUser.id,
    }),
  },
  appUserToken: {
    user: r.one.appUser({ from: r.appUserToken.userId, to: r.appUser.id }),
  },
  growthAuditLog: {
    user: r.one.appUser({ from: r.growthAuditLog.userId, to: r.appUser.id }),
  },
  userAssetBalance: {
    user: r.one.appUser({
      from: r.userAssetBalance.userId,
      to: r.appUser.id,
    }),
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
  },
  checkInMakeupAccount: {
    user: r.one.appUser({
      from: r.checkInMakeupAccount.userId,
      to: r.appUser.id,
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
  userBrowseLog: {
    user: r.one.appUser({ from: r.userBrowseLog.userId, to: r.appUser.id }),
  },
  userComment: {
    user: r.one.appUser({ from: r.userComment.userId, to: r.appUser.id }),
    replyTo: r.one.userComment({
      from: r.userComment.replyToId,
      to: r.userComment.id,
      alias: 'CommentReply',
    }),
    replies: r.many.userComment({
      from: r.userComment.id,
      to: r.userComment.replyToId,
      alias: 'CommentReply',
    }),
    actualReplyTo: r.one.userComment({
      from: r.userComment.actualReplyToId,
      to: r.userComment.id,
      alias: 'CommentActualReply',
    }),
    actualReplies: r.many.userComment({
      from: r.userComment.id,
      to: r.userComment.actualReplyToId,
      alias: 'CommentActualReply',
    }),
  },
  userDownloadRecord: {
    user: r.one.appUser({
      from: r.userDownloadRecord.userId,
      to: r.appUser.id,
    }),
  },
  userFavorite: {
    user: r.one.appUser({ from: r.userFavorite.userId, to: r.appUser.id }),
  },
  userLevelRule: {
    users: r.many.appUser(),
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
  userLike: {
    user: r.one.appUser({ from: r.userLike.userId, to: r.appUser.id }),
  },
  userPurchaseRecord: {
    user: r.one.appUser({
      from: r.userPurchaseRecord.userId,
      to: r.appUser.id,
    }),
    purchaseEntitlements: r.many.userContentEntitlement({
      from: r.userPurchaseRecord.id,
      to: r.userContentEntitlement.sourceId,
      alias: 'PurchaseEntitlements',
    }),
  },
  userContentEntitlement: {
    user: r.one.appUser({
      from: r.userContentEntitlement.userId,
      to: r.appUser.id,
    }),
    purchaseRecord: r.one.userPurchaseRecord({
      from: r.userContentEntitlement.sourceId,
      to: r.userPurchaseRecord.id,
      alias: 'PurchaseEntitlementRecord',
    }),
  },
  membershipPlan: {
    subscriptions: r.many.userMembershipSubscription(),
    autoRenewAgreements: r.many.membershipAutoRenewAgreement(),
    benefits: r.many.membershipPlanBenefit(),
    claimRecords: r.many.membershipBenefitClaimRecord(),
  },
  membershipPageConfig: {
    agreements: r.many.appAgreement({
      from: r.membershipPageConfig.id.through(
        r.membershipPageConfigAgreement.pageConfigId,
      ),
      to: r.appAgreement.id.through(
        r.membershipPageConfigAgreement.agreementId,
      ),
    }),
  },
  membershipPageConfigAgreement: {
    pageConfig: r.one.membershipPageConfig({
      from: r.membershipPageConfigAgreement.pageConfigId,
      to: r.membershipPageConfig.id,
    }),
    agreement: r.one.appAgreement({
      from: r.membershipPageConfigAgreement.agreementId,
      to: r.appAgreement.id,
    }),
  },
  membershipBenefitDefinition: {
    planBenefits: r.many.membershipPlanBenefit(),
    claimRecords: r.many.membershipBenefitClaimRecord(),
  },
  membershipPlanBenefit: {
    plan: r.one.membershipPlan({
      from: r.membershipPlanBenefit.planId,
      to: r.membershipPlan.id,
    }),
    benefit: r.one.membershipBenefitDefinition({
      from: r.membershipPlanBenefit.benefitId,
      to: r.membershipBenefitDefinition.id,
    }),
  },
  membershipBenefitClaimRecord: {
    user: r.one.appUser({
      from: r.membershipBenefitClaimRecord.userId,
      to: r.appUser.id,
    }),
    plan: r.one.membershipPlan({
      from: r.membershipBenefitClaimRecord.planId,
      to: r.membershipPlan.id,
    }),
    benefit: r.one.membershipBenefitDefinition({
      from: r.membershipBenefitClaimRecord.benefitId,
      to: r.membershipBenefitDefinition.id,
    }),
    subscription: r.one.userMembershipSubscription({
      from: r.membershipBenefitClaimRecord.subscriptionId,
      to: r.userMembershipSubscription.id,
    }),
  },
  userMembershipSubscription: {
    user: r.one.appUser({
      from: r.userMembershipSubscription.userId,
      to: r.appUser.id,
    }),
    plan: r.one.membershipPlan({
      from: r.userMembershipSubscription.planId,
      to: r.membershipPlan.id,
    }),
    benefitClaimRecords: r.many.membershipBenefitClaimRecord(),
  },
  membershipAutoRenewAgreement: {
    user: r.one.appUser({
      from: r.membershipAutoRenewAgreement.userId,
      to: r.appUser.id,
    }),
    plan: r.one.membershipPlan({
      from: r.membershipAutoRenewAgreement.planId,
      to: r.membershipPlan.id,
    }),
    providerConfig: r.one.paymentProviderConfig({
      from: r.membershipAutoRenewAgreement.providerConfigId,
      to: r.paymentProviderConfig.id,
    }),
  },
  paymentProviderConfig: {
    orders: r.many.paymentOrder(),
    autoRenewAgreements: r.many.membershipAutoRenewAgreement(),
  },
  paymentOrder: {
    user: r.one.appUser({
      from: r.paymentOrder.userId,
      to: r.appUser.id,
    }),
    providerConfig: r.one.paymentProviderConfig({
      from: r.paymentOrder.providerConfigId,
      to: r.paymentProviderConfig.id,
    }),
    autoRenewAgreement: r.one.membershipAutoRenewAgreement({
      from: r.paymentOrder.autoRenewAgreementId,
      to: r.membershipAutoRenewAgreement.id,
    }),
  },
  adProviderConfig: {
    rewardRecords: r.many.adRewardRecord(),
  },
  adRewardRecord: {
    user: r.one.appUser({
      from: r.adRewardRecord.userId,
      to: r.appUser.id,
    }),
    providerConfig: r.one.adProviderConfig({
      from: r.adRewardRecord.adProviderConfigId,
      to: r.adProviderConfig.id,
    }),
  },
  couponDefinition: {
    instances: r.many.userCouponInstance(),
  },
  userCouponInstance: {
    user: r.one.appUser({
      from: r.userCouponInstance.userId,
      to: r.appUser.id,
    }),
    definition: r.one.couponDefinition({
      from: r.userCouponInstance.couponDefinitionId,
      to: r.couponDefinition.id,
    }),
    redemptionRecords: r.many.couponRedemptionRecord(),
  },
  couponRedemptionRecord: {
    user: r.one.appUser({
      from: r.couponRedemptionRecord.userId,
      to: r.appUser.id,
    }),
    couponInstance: r.one.userCouponInstance({
      from: r.couponRedemptionRecord.couponInstanceId,
      to: r.userCouponInstance.id,
    }),
  },
  userReport: {
    reporter: r.one.appUser({
      from: r.userReport.reporterId,
      to: r.appUser.id,
      alias: 'UserReportReporter',
    }),
    handler: r.one.appUser({
      from: r.userReport.handlerId,
      to: r.appUser.id,
      alias: 'UserReportHandler',
    }),
  },
  userWorkReadingState: {
    user: r.one.appUser({
      from: r.userWorkReadingState.userId,
      to: r.appUser.id,
    }),
    work: r.one.work({ from: r.userWorkReadingState.workId, to: r.work.id }),
    lastReadChapter: r.one.workChapter({
      from: r.userWorkReadingState.lastReadChapterId,
      to: r.workChapter.id,
      alias: 'UserWorkReadingStateLastReadChapter',
    }),
  },
}))
