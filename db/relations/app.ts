import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema/index'

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
  appPage: {
    announcements: r.many.appAnnouncement({
      from: r.appPage.id,
      to: r.appAnnouncement.pageId,
      alias: 'announcements',
    }),
  },
  appUser: {
    agreementLogs: r.many.appAgreementLog(),
    level: r.one.appUserLevelRule({
      from: r.appUser.levelId,
      to: r.appUserLevelRule.id,
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
    receivedNotifications: r.many.appUserNotification({
      from: r.appUser.id,
      to: r.appUserNotification.userId,
      alias: 'AppUserNotificationReceiver',
    }),
    notificationPreferences: r.many.appUserNotificationPreference({
      from: r.appUser.id,
      to: r.appUserNotificationPreference.userId,
      alias: 'AppUserNotificationPreferenceUser',
    }),
    notificationDeliveries: r.many.notificationDelivery({
      from: r.appUser.id,
      to: r.notificationDelivery.receiverUserId,
    }),
    triggeredNotifications: r.many.appUserNotification({
      from: r.appUser.id,
      to: r.appUserNotification.actorUserId,
      alias: 'AppUserNotificationActor',
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
    badgeAssignments: r.many.appUserBadgeAssignment(),
    badges: r.many.appBadge({
      from: r.appUser.id.through(r.appUserBadgeAssignment.userId),
      to: r.appBadge.id.through(r.appUserBadgeAssignment.badgeId),
    }),
    growthLedgerRecords: r.many.growthLedgerRecord(),
    growthAuditLogs: r.many.growthAuditLog(),
    growthRuleUsageSlots: r.many.growthRuleUsageSlot(),
    checkInCycles: r.many.checkInCycle(),
    checkInRecords: r.many.checkInRecord(),
    checkInStreakRewardGrants: r.many.checkInStreakRewardGrant(),
    taskAssignments: r.many.taskAssignment(),
    taskProgressLogs: r.many.taskProgressLog(),
    userLikes: r.many.appUserLike(),
    userFavorites: r.many.appUserFavorite(),
    browseLogs: r.many.appUserBrowseLog(),
    workReadingStates: r.many.appUserWorkReadingState(),
    userComments: r.many.appUserComment(),
    userReports: r.many.appUserReport({
      from: r.appUser.id,
      to: r.appUserReport.reporterId,
      alias: 'AppUserReportReporter',
    }),
    handledUserReports: r.many.appUserReport({
      from: r.appUser.id,
      to: r.appUserReport.handlerId,
      alias: 'AppUserReportHandler',
    }),
    userDownloadRecords: r.many.appUserDownloadRecord(),
    userPurchaseRecords: r.many.appUserPurchaseRecord(),
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
  growthLedgerRecord: {
    user: r.one.appUser({
      from: r.growthLedgerRecord.userId,
      to: r.appUser.id,
    }),
  },
  growthRuleUsageSlot: {
    user: r.one.appUser({
      from: r.growthRuleUsageSlot.userId,
      to: r.appUser.id,
    }),
  },
  checkInPlan: {
    cycles: r.many.checkInCycle(),
    records: r.many.checkInRecord(),
    streakRules: r.many.checkInStreakRewardRule(),
    streakGrants: r.many.checkInStreakRewardGrant(),
    createdBy: r.one.adminUser({
      from: r.checkInPlan.createdById,
      to: r.adminUser.id,
      alias: 'CheckInPlanCreatedBy',
    }),
    updatedBy: r.one.adminUser({
      from: r.checkInPlan.updatedById,
      to: r.adminUser.id,
      alias: 'CheckInPlanUpdatedBy',
    }),
  },
  checkInCycle: {
    user: r.one.appUser({
      from: r.checkInCycle.userId,
      to: r.appUser.id,
    }),
    plan: r.one.checkInPlan({
      from: r.checkInCycle.planId,
      to: r.checkInPlan.id,
    }),
    records: r.many.checkInRecord(),
    streakGrants: r.many.checkInStreakRewardGrant(),
  },
  checkInRecord: {
    user: r.one.appUser({
      from: r.checkInRecord.userId,
      to: r.appUser.id,
    }),
    plan: r.one.checkInPlan({
      from: r.checkInRecord.planId,
      to: r.checkInPlan.id,
    }),
    cycle: r.one.checkInCycle({
      from: r.checkInRecord.cycleId,
      to: r.checkInCycle.id,
    }),
  },
  checkInStreakRewardRule: {
    plan: r.one.checkInPlan({
      from: r.checkInStreakRewardRule.planId,
      to: r.checkInPlan.id,
    }),
    grants: r.many.checkInStreakRewardGrant(),
  },
  checkInStreakRewardGrant: {
    user: r.one.appUser({
      from: r.checkInStreakRewardGrant.userId,
      to: r.appUser.id,
    }),
    plan: r.one.checkInPlan({
      from: r.checkInStreakRewardGrant.planId,
      to: r.checkInPlan.id,
    }),
    cycle: r.one.checkInCycle({
      from: r.checkInStreakRewardGrant.cycleId,
      to: r.checkInCycle.id,
    }),
    rule: r.one.checkInStreakRewardRule({
      from: r.checkInStreakRewardGrant.ruleId,
      to: r.checkInStreakRewardRule.id,
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
    progressLogs: r.many.taskProgressLog(),
  },
  taskProgressLog: {
    assignment: r.one.taskAssignment({
      from: r.taskProgressLog.assignmentId,
      to: r.taskAssignment.id,
    }),
    user: r.one.appUser({ from: r.taskProgressLog.userId, to: r.appUser.id }),
  },
  appBadge: {
    assignments: r.many.appUserBadgeAssignment(),
    users: r.many.appUser({
      from: r.appBadge.id.through(r.appUserBadgeAssignment.badgeId),
      to: r.appUser.id.through(r.appUserBadgeAssignment.userId),
    }),
  },
  appUserBadgeAssignment: {
    badge: r.one.appBadge({
      from: r.appUserBadgeAssignment.badgeId,
      to: r.appBadge.id,
    }),
    user: r.one.appUser({
      from: r.appUserBadgeAssignment.userId,
      to: r.appUser.id,
    }),
  },
  appUserBrowseLog: {
    user: r.one.appUser({ from: r.appUserBrowseLog.userId, to: r.appUser.id }),
  },
  appUserComment: {
    user: r.one.appUser({ from: r.appUserComment.userId, to: r.appUser.id }),
    replyTo: r.one.appUserComment({
      from: r.appUserComment.replyToId,
      to: r.appUserComment.id,
      alias: 'CommentReply',
    }),
    replies: r.many.appUserComment({
      from: r.appUserComment.id,
      to: r.appUserComment.replyToId,
      alias: 'CommentReply',
    }),
    actualReplyTo: r.one.appUserComment({
      from: r.appUserComment.actualReplyToId,
      to: r.appUserComment.id,
      alias: 'CommentActualReply',
    }),
    actualReplies: r.many.appUserComment({
      from: r.appUserComment.id,
      to: r.appUserComment.actualReplyToId,
      alias: 'CommentActualReply',
    }),
  },
  appUserDownloadRecord: {
    user: r.one.appUser({
      from: r.appUserDownloadRecord.userId,
      to: r.appUser.id,
    }),
  },
  appUserFavorite: {
    user: r.one.appUser({ from: r.appUserFavorite.userId, to: r.appUser.id }),
  },
  appUserLevelRule: {
    users: r.many.appUser(),
    sections: r.many.forumSection({
      from: r.appUserLevelRule.id,
      to: r.forumSection.userLevelRuleId,
    }),
    chaptersAsReadLevel: r.many.workChapter({
      from: r.appUserLevelRule.id,
      to: r.workChapter.requiredViewLevelId,
      alias: 'ChapterReadLevel',
    }),
    worksAsViewLevel: r.many.work({
      from: r.appUserLevelRule.id,
      to: r.work.requiredViewLevelId,
      alias: 'WorkViewLevel',
    }),
  },
  appUserLike: {
    user: r.one.appUser({ from: r.appUserLike.userId, to: r.appUser.id }),
  },
  appUserPurchaseRecord: {
    user: r.one.appUser({
      from: r.appUserPurchaseRecord.userId,
      to: r.appUser.id,
    }),
  },
  appUserReport: {
    reporter: r.one.appUser({
      from: r.appUserReport.reporterId,
      to: r.appUser.id,
      alias: 'AppUserReportReporter',
    }),
    handler: r.one.appUser({
      from: r.appUserReport.handlerId,
      to: r.appUser.id,
      alias: 'AppUserReportHandler',
    }),
  },
  appUserWorkReadingState: {
    user: r.one.appUser({
      from: r.appUserWorkReadingState.userId,
      to: r.appUser.id,
    }),
    work: r.one.work({ from: r.appUserWorkReadingState.workId, to: r.work.id }),
    lastReadChapter: r.one.workChapter({
      from: r.appUserWorkReadingState.lastReadChapterId,
      to: r.workChapter.id,
      alias: 'AppUserWorkReadingStateLastReadChapter',
    }),
  },
}))
