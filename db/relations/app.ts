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
      to: r.userNotification.userId,
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
    growthAuditLogs: r.many.growthAuditLog(),
    growthRuleUsageSlots: r.many.growthRuleUsageSlot(),
    checkInCycles: r.many.checkInCycle(),
    checkInRecords: r.many.checkInRecord(),
    checkInStreakRewardGrants: r.many.checkInStreakRewardGrant(),
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
    dateRewardRules: r.many.checkInDateRewardRule(),
    patternRewardRules: r.many.checkInPatternRewardRule(),
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
  checkInDateRewardRule: {
    plan: r.one.checkInPlan({
      from: r.checkInDateRewardRule.planId,
      to: r.checkInPlan.id,
    }),
  },
  checkInPatternRewardRule: {
    plan: r.one.checkInPlan({
      from: r.checkInPatternRewardRule.planId,
      to: r.checkInPlan.id,
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
