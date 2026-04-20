import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const appRelations = defineRelationsPart(schema, (r) => ({
  appAgreement: {
    agreementLogs: r.many.appAgreementLog(),
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
    checkInDailyStreakProgresses: r.many.checkInDailyStreakProgress(),
    checkInActivityStreakProgresses: r.many.checkInActivityStreakProgress(),
    checkInStreakGrants: r.many.checkInStreakGrant(),
    checkInRecords: r.many.checkInRecord(),
    taskAssignments: r.many.taskAssignment(),
    taskProgressLogs: r.many.taskProgressLog(),
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
  checkInDailyStreakConfig: {
    updatedBy: r.one.adminUser({
      from: r.checkInDailyStreakConfig.updatedById,
      to: r.adminUser.id,
      alias: 'CheckInDailyStreakConfigUpdatedBy',
    }),
    rules: r.many.checkInDailyStreakRule(),
    grants: r.many.checkInStreakGrant({
      from: r.checkInDailyStreakConfig.id,
      to: r.checkInStreakGrant.configVersionId,
      alias: 'DailyStreakConfigGrants',
    }),
  },
  checkInDailyStreakRule: {
    config: r.one.checkInDailyStreakConfig({
      from: r.checkInDailyStreakRule.configId,
      to: r.checkInDailyStreakConfig.id,
    }),
    rewardItems: r.many.checkInDailyStreakRuleRewardItem(),
    grants: r.many.checkInStreakGrant({
      from: r.checkInDailyStreakRule.id,
      to: r.checkInStreakGrant.dailyRuleId,
      alias: 'DailyRuleGrants',
    }),
  },
  checkInDailyStreakRuleRewardItem: {
    rule: r.one.checkInDailyStreakRule({
      from: r.checkInDailyStreakRuleRewardItem.ruleId,
      to: r.checkInDailyStreakRule.id,
    }),
  },
  checkInDailyStreakProgress: {
    user: r.one.appUser({
      from: r.checkInDailyStreakProgress.userId,
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
  checkInActivityStreak: {
    updatedBy: r.one.adminUser({
      from: r.checkInActivityStreak.updatedById,
      to: r.adminUser.id,
      alias: 'CheckInActivityStreakUpdatedBy',
    }),
    rules: r.many.checkInActivityStreakRule(),
    progresses: r.many.checkInActivityStreakProgress(),
    grants: r.many.checkInStreakGrant({
      from: r.checkInActivityStreak.id,
      to: r.checkInStreakGrant.activityId,
      alias: 'ActivityStreakGrants',
    }),
  },
  checkInActivityStreakRule: {
    activity: r.one.checkInActivityStreak({
      from: r.checkInActivityStreakRule.activityId,
      to: r.checkInActivityStreak.id,
    }),
    rewardItems: r.many.checkInActivityStreakRuleRewardItem(),
    grants: r.many.checkInStreakGrant({
      from: r.checkInActivityStreakRule.id,
      to: r.checkInStreakGrant.activityRuleId,
      alias: 'ActivityRuleGrants',
    }),
  },
  checkInActivityStreakRuleRewardItem: {
    rule: r.one.checkInActivityStreakRule({
      from: r.checkInActivityStreakRuleRewardItem.ruleId,
      to: r.checkInActivityStreakRule.id,
    }),
  },
  checkInActivityStreakProgress: {
    activity: r.one.checkInActivityStreak({
      from: r.checkInActivityStreakProgress.activityId,
      to: r.checkInActivityStreak.id,
    }),
    user: r.one.appUser({
      from: r.checkInActivityStreakProgress.userId,
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
    dailyConfig: r.one.checkInDailyStreakConfig({
      from: r.checkInStreakGrant.configVersionId,
      to: r.checkInDailyStreakConfig.id,
      alias: 'StreakGrantDailyConfig',
    }),
    dailyRule: r.one.checkInDailyStreakRule({
      from: r.checkInStreakGrant.dailyRuleId,
      to: r.checkInDailyStreakRule.id,
      alias: 'StreakGrantDailyRule',
    }),
    activity: r.one.checkInActivityStreak({
      from: r.checkInStreakGrant.activityId,
      to: r.checkInActivityStreak.id,
      alias: 'StreakGrantActivity',
    }),
    activityRule: r.one.checkInActivityStreakRule({
      from: r.checkInStreakGrant.activityRuleId,
      to: r.checkInActivityStreakRule.id,
      alias: 'StreakGrantActivityRule',
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
  task: {
    assignments: r.many.taskAssignment(),
    createdBy: r.one.adminUser({
      from: r.task.createdById,
      to: r.adminUser.id,
      alias: 'TaskCreatedBy',
    }),
    updatedBy: r.one.adminUser({
      from: r.task.updatedById,
      to: r.adminUser.id,
      alias: 'TaskUpdatedBy',
    }),
  },
  taskAssignment: {
    task: r.one.task({ from: r.taskAssignment.taskId, to: r.task.id }),
    user: r.one.appUser({ from: r.taskAssignment.userId, to: r.appUser.id }),
    rewardSettlement: r.one.growthRewardSettlement({
      from: r.taskAssignment.rewardSettlementId,
      to: r.growthRewardSettlement.id,
    }),
    progressLogs: r.many.taskProgressLog(),
  },
  taskProgressLog: {
    assignment: r.one.taskAssignment({
      from: r.taskProgressLog.assignmentId,
      to: r.taskAssignment.id,
    }),
    user: r.one.appUser({ from: r.taskProgressLog.userId, to: r.appUser.id }),
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
