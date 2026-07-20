import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const userRelations = defineRelationsPart(schema, (r) => ({
  appUser: {
    agreementLogs: r.many.appAgreementLog({
      from: r.appUser.id,
      to: r.appAgreementLog.userId,
    }),
    level: r.one.userLevelRule({
      from: r.appUser.levelId,
      to: r.userLevelRule.id,
    }),
    counts: r.one.appUserCount({
      from: r.appUser.id,
      to: r.appUserCount.userId,
    }),
    announcementReads: r.many.appAnnouncementRead({
      from: r.appUser.id,
      to: r.appAnnouncementRead.userId,
    }),
    announcementViews: r.many.appAnnouncementView({
      from: r.appUser.id,
      to: r.appAnnouncementView.userId,
    }),
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
    createdForumHashtags: r.many.forumHashtag({
      from: r.appUser.id,
      to: r.forumHashtag.createdByUserId,
    }),
    forumHashtagReferences: r.many.forumHashtagReference({
      from: r.appUser.id,
      to: r.forumHashtagReference.userId,
    }),
    badgeAssignments: r.many.userBadgeAssignment({
      from: r.appUser.id,
      to: r.userBadgeAssignment.userId,
    }),
    badges: r.many.userBadge({
      from: r.appUser.id.through(r.userBadgeAssignment.userId),
      to: r.userBadge.id.through(r.userBadgeAssignment.badgeId),
    }),
    growthLedgerRecords: r.many.growthLedgerRecord({
      from: r.appUser.id,
      to: r.growthLedgerRecord.userId,
    }),
    growthRewardSettlements: r.many.growthRewardSettlement({
      from: r.appUser.id,
      to: r.growthRewardSettlement.userId,
    }),
    growthAuditLogs: r.many.growthAuditLog({
      from: r.appUser.id,
      to: r.growthAuditLog.userId,
    }),
    assetBalances: r.many.userAssetBalance({
      from: r.appUser.id,
      to: r.userAssetBalance.userId,
    }),
    growthRuleUsageCounters: r.many.growthRuleUsageCounter({
      from: r.appUser.id,
      to: r.growthRuleUsageCounter.userId,
    }),
    checkInMakeupFacts: r.many.checkInMakeupFact({
      from: r.appUser.id,
      to: r.checkInMakeupFact.userId,
    }),
    checkInMakeupAccounts: r.many.checkInMakeupAccount({
      from: r.appUser.id,
      to: r.checkInMakeupAccount.userId,
    }),
    checkInStreakProgresses: r.many.checkInStreakProgress({
      from: r.appUser.id,
      to: r.checkInStreakProgress.userId,
    }),
    checkInStreakGrants: r.many.checkInStreakGrant({
      from: r.appUser.id,
      to: r.checkInStreakGrant.userId,
    }),
    checkInRecords: r.many.checkInRecord({
      from: r.appUser.id,
      to: r.checkInRecord.userId,
    }),
    taskInstances: r.many.taskInstance({
      from: r.appUser.id,
      to: r.taskInstance.userId,
    }),
    taskStepUniqueFacts: r.many.taskStepUniqueFact({
      from: r.appUser.id,
      to: r.taskStepUniqueFact.userId,
    }),
    taskEventLogs: r.many.taskEventLog({
      from: r.appUser.id,
      to: r.taskEventLog.userId,
    }),
    taskEventFailures: r.many.taskEventFailure({
      from: r.appUser.id,
      to: r.taskEventFailure.userId,
    }),
    userLikes: r.many.userLike({
      from: r.appUser.id,
      to: r.userLike.userId,
    }),
    userFavorites: r.many.userFavorite({
      from: r.appUser.id,
      to: r.userFavorite.userId,
    }),
    userFollows: r.many.userFollow({
      from: r.appUser.id,
      to: r.userFollow.userId,
    }),
    receivedMentions: r.many.userMention({
      from: r.appUser.id,
      to: r.userMention.mentionedUserId,
    }),
    browseLogs: r.many.userBrowseLog({
      from: r.appUser.id,
      to: r.userBrowseLog.userId,
    }),
    workReadingStates: r.many.userWorkReadingState({
      from: r.appUser.id,
      to: r.userWorkReadingState.userId,
    }),
    userComments: r.many.userComment({
      from: r.appUser.id,
      to: r.userComment.userId,
    }),
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
    reportDispositionAttempts: r.many.userReportDispositionAttempt({
      from: r.appUser.id,
      to: r.userReportDispositionAttempt.actorUserId,
    }),
    userDownloadRecords: r.many.userDownloadRecord({
      from: r.appUser.id,
      to: r.userDownloadRecord.userId,
    }),
    userPurchaseRecords: r.many.userPurchaseRecord({
      from: r.appUser.id,
      to: r.userPurchaseRecord.userId,
    }),
    contentEntitlements: r.many.userContentEntitlement({
      from: r.appUser.id,
      to: r.userContentEntitlement.userId,
    }),
    membershipSubscriptions: r.many.userMembershipSubscription({
      from: r.appUser.id,
      to: r.userMembershipSubscription.userId,
    }),
    paymentOrders: r.many.paymentOrder({
      from: r.appUser.id,
      to: r.paymentOrder.userId,
    }),
    userCouponInstances: r.many.userCouponInstance({
      from: r.appUser.id,
      to: r.userCouponInstance.userId,
    }),
    couponRedemptionRecords: r.many.couponRedemptionRecord({
      from: r.appUser.id,
      to: r.couponRedemptionRecord.userId,
    }),
    couponAdminGrantItems: r.many.couponAdminGrantItem({
      from: r.appUser.id,
      to: r.couponAdminGrantItem.userId,
    }),
    adRewardRecords: r.many.adRewardRecord({
      from: r.appUser.id,
      to: r.adRewardRecord.userId,
    }),
    emojiRecentUsageRecords: r.many.emojiRecentUsage({
      from: r.appUser.id,
      to: r.emojiRecentUsage.userId,
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
}))
