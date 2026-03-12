import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
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
  appPage: {
    announcements: r.many.appAnnouncement({ alias: 'announcements' }),
  },
  appUser: {
    agreementLogs: r.many.appAgreementLog(),
    level: r.one.userLevelRule({
      from: r.appUser.levelId,
      to: r.userLevelRule.id,
    }),
    forumProfile: r.one.forumProfile({
      from: r.appUser.id,
      to: r.forumProfile.userId,
    }),
    announcementReads: r.many.appAnnouncementRead(),
    tokens: r.many.appUserToken(),
    forumTopics: r.many.forumTopic({ alias: 'UserTopics' }),
    lastReplyTopics: r.many.forumTopic({ alias: 'UserLastReplyTopics' }),
    forumNotifications: r.many.forumNotification(),
    receivedNotifications: r.many.userNotification({
      alias: 'UserNotificationReceiver',
    }),
    triggeredNotifications: r.many.userNotification({
      alias: 'UserNotificationActor',
    }),
    chatConversationMembers: r.many.chatConversationMember({
      alias: 'ChatConversationMemberUser',
    }),
    chatConversations: r.many.chatConversation({
      from: r.appUser.id.through(r.chatConversationMember.userId),
      to: r.chatConversation.id.through(
        r.chatConversationMember.conversationId,
      ),
      alias: 'ChatConversationParticipants',
    }),
    sentChatMessages: r.many.chatMessage({ alias: 'ChatMessageSender' }),
    lastSentConversations: r.many.chatConversation({
      alias: 'ChatConversationLastSender',
    }),
    moderatorApplications: r.many.forumModeratorApplication({
      alias: 'ModeratorApplicant',
    }),
    auditedApplications: r.many.forumModeratorApplication({
      alias: 'ModeratorAuditor',
    }),
    moderator: r.one.forumModerator({
      from: r.appUser.id,
      to: r.forumModerator.userId,
    }),
    forumActionLogs: r.many.forumUserActionLog(),
    userBadges: r.many.userBadgeAssignment(),
    badges: r.many.userBadge({
      from: r.appUser.id.through(r.userBadgeAssignment.userId),
      to: r.userBadge.id.through(r.userBadgeAssignment.badgeId),
    }),
    growthLedgerRecords: r.many.growthLedgerRecord(),
    growthAuditLogs: r.many.growthAuditLog(),
    growthRuleUsageSlots: r.many.growthRuleUsageSlot(),
    taskAssignments: r.many.taskAssignment(),
    taskProgressLogs: r.many.taskProgressLog(),
    updatedConfigs: r.many.forumConfig({ alias: 'ForumConfigUpdater' }),
    operatedConfigHistories: r.many.forumConfigHistory({
      alias: 'ForumConfigHistoryOperator',
    }),
    userLikes: r.many.userLike(),
    userFavorites: r.many.userFavorite(),
    browseLogs: r.many.userBrowseLog(),
    workReadingStates: r.many.userWorkReadingState(),
    userComments: r.many.userComment(),
    userReports: r.many.userReport({ alias: 'UserReportReporter' }),
    handledUserReports: r.many.userReport({ alias: 'UserReportHandler' }),
    userDownloadRecords: r.many.userDownloadRecord(),
    userPurchaseRecords: r.many.userPurchaseRecord(),
  },
  appUserToken: {
    user: r.one.appUser({ from: r.appUserToken.userId, to: r.appUser.id }),
  },
  chatConversation: {
    lastSender: r.one.appUser({
      from: r.chatConversation.lastSenderId,
      to: r.appUser.id,
      alias: 'ChatConversationLastSender',
    }),
    members: r.many.chatConversationMember(),
    participants: r.many.appUser({
      from: r.chatConversation.id.through(
        r.chatConversationMember.conversationId,
      ),
      to: r.appUser.id.through(r.chatConversationMember.userId),
      alias: 'ChatConversationParticipants',
    }),
    messages: r.many.chatMessage(),
  },
  chatConversationMember: {
    conversation: r.one.chatConversation({
      from: r.chatConversationMember.conversationId,
      to: r.chatConversation.id,
    }),
    user: r.one.appUser({
      from: r.chatConversationMember.userId,
      to: r.appUser.id,
      alias: 'ChatConversationMemberUser',
    }),
  },
  chatMessage: {
    conversation: r.one.chatConversation({
      from: r.chatMessage.conversationId,
      to: r.chatConversation.id,
    }),
    sender: r.one.appUser({
      from: r.chatMessage.senderId,
      to: r.appUser.id,
      alias: 'ChatMessageSender',
    }),
  },
  dictionary: {
    dictionaryItems: r.many.dictionaryItem(),
  },
  dictionaryItem: {
    parentDictionary: r.one.dictionary({
      from: r.dictionaryItem.dictionaryCode,
      to: r.dictionary.code,
    }),
  },
  forumConfig: {
    histories: r.many.forumConfigHistory(),
    updatedBy: r.one.appUser({
      from: r.forumConfig.updatedById,
      to: r.appUser.id,
      alias: 'ForumConfigUpdater',
    }),
  },
  forumConfigHistory: {
    config: r.one.forumConfig({
      from: r.forumConfigHistory.configId,
      to: r.forumConfig.id,
    }),
    operatedBy: r.one.appUser({
      from: r.forumConfigHistory.operatedById,
      to: r.appUser.id,
      alias: 'ForumConfigHistoryOperator',
    }),
  },
  forumModerator: {
    user: r.one.appUser({ from: r.forumModerator.userId, to: r.appUser.id }),
    group: r.one.forumSectionGroup({
      from: r.forumModerator.groupId,
      to: r.forumSectionGroup.id,
    }),
    actionLogs: r.many.forumModeratorActionLog(),
    sections: r.many.forumModeratorSection(),
    moderatedSections: r.many.forumSection({
      from: r.forumModerator.id.through(r.forumModeratorSection.moderatorId),
      to: r.forumSection.id.through(r.forumModeratorSection.sectionId),
    }),
  },
  forumModeratorActionLog: {
    moderator: r.one.forumModerator({
      from: r.forumModeratorActionLog.moderatorId,
      to: r.forumModerator.id,
    }),
  },
  forumModeratorApplication: {
    applicant: r.one.appUser({
      from: r.forumModeratorApplication.applicantId,
      to: r.appUser.id,
      alias: 'ModeratorApplicant',
    }),
    auditBy: r.one.appUser({
      from: r.forumModeratorApplication.auditById,
      to: r.appUser.id,
      alias: 'ModeratorAuditor',
    }),
    section: r.one.forumSection({
      from: r.forumModeratorApplication.sectionId,
      to: r.forumSection.id,
    }),
  },
  forumModeratorSection: {
    moderator: r.one.forumModerator({
      from: r.forumModeratorSection.moderatorId,
      to: r.forumModerator.id,
    }),
    section: r.one.forumSection({
      from: r.forumModeratorSection.sectionId,
      to: r.forumSection.id,
    }),
  },
  forumNotification: {
    user: r.one.appUser({ from: r.forumNotification.userId, to: r.appUser.id }),
    topic: r.one.forumTopic({
      from: r.forumNotification.topicId,
      to: r.forumTopic.id,
      alias: 'NotificationTopic',
    }),
  },
  forumProfile: {
    user: r.one.appUser({ from: r.forumProfile.userId, to: r.appUser.id }),
  },
  forumSection: {
    group: r.one.forumSectionGroup({
      from: r.forumSection.groupId,
      to: r.forumSectionGroup.id,
    }),
    userLevelRule: r.one.userLevelRule({
      from: r.forumSection.userLevelRuleId,
      to: r.userLevelRule.id,
    }),
    lastTopic: r.one.forumTopic({
      from: r.forumSection.lastTopicId,
      to: r.forumTopic.id,
      alias: 'LastTopic',
    }),
    topics: r.many.forumTopic(),
    moderatorSections: r.many.forumModeratorSection(),
    moderators: r.many.forumModerator({
      from: r.forumSection.id.through(r.forumModeratorSection.sectionId),
      to: r.forumModerator.id.through(r.forumModeratorSection.moderatorId),
    }),
    applications: r.many.forumModeratorApplication(),
  },
  forumSectionGroup: {
    sections: r.many.forumSection(),
    moderators: r.many.forumModerator(),
  },
  forumTag: {
    topicTags: r.many.forumTopicTag(),
    topics: r.many.forumTopic({
      from: r.forumTag.id.through(r.forumTopicTag.tagId),
      to: r.forumTopic.id.through(r.forumTopicTag.topicId),
    }),
  },
  forumTopic: {
    section: r.one.forumSection({
      from: r.forumTopic.sectionId,
      to: r.forumSection.id,
    }),
    user: r.one.appUser({
      from: r.forumTopic.userId,
      to: r.appUser.id,
      alias: 'UserTopics',
    }),
    lastReplyUser: r.one.appUser({
      from: r.forumTopic.lastReplyUserId,
      to: r.appUser.id,
      alias: 'UserLastReplyTopics',
    }),
    lastSections: r.many.forumSection({ alias: 'LastTopic' }),
    topicTags: r.many.forumTopicTag(),
    tags: r.many.forumTag({
      from: r.forumTopic.id.through(r.forumTopicTag.topicId),
      to: r.forumTag.id.through(r.forumTopicTag.tagId),
    }),
    notifications: r.many.forumNotification({ alias: 'NotificationTopic' }),
  },
  forumTopicTag: {
    tag: r.one.forumTag({ from: r.forumTopicTag.tagId, to: r.forumTag.id }),
    topic: r.one.forumTopic({
      from: r.forumTopicTag.topicId,
      to: r.forumTopic.id,
    }),
  },
  forumUserActionLog: {
    user: r.one.appUser({
      from: r.forumUserActionLog.userId,
      to: r.appUser.id,
    }),
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
  systemConfig: {
    updatedBy: r.one.adminUser({
      from: r.systemConfig.updatedById,
      to: r.adminUser.id,
      alias: 'SystemConfigUpdater',
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
    replies: r.many.userComment({ alias: 'CommentReply' }),
    actualReplyTo: r.one.userComment({
      from: r.userComment.actualReplyToId,
      to: r.userComment.id,
      alias: 'CommentActualReply',
    }),
    actualReplies: r.many.userComment({ alias: 'CommentActualReply' }),
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
    sections: r.many.forumSection(),
    chaptersAsReadLevel: r.many.workChapter({ alias: 'ChapterReadLevel' }),
    worksAsViewLevel: r.many.work({ alias: 'WorkViewLevel' }),
  },
  userLike: {
    user: r.one.appUser({ from: r.userLike.userId, to: r.appUser.id }),
  },
  userNotification: {
    user: r.one.appUser({
      from: r.userNotification.userId,
      to: r.appUser.id,
      alias: 'UserNotificationReceiver',
    }),
    actorUser: r.one.appUser({
      from: r.userNotification.actorUserId,
      to: r.appUser.id,
      alias: 'UserNotificationActor',
    }),
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
  work: {
    comic: r.one.workComic({
      from: r.work.id,
      to: r.workComic.workId,
    }),
    novel: r.one.workNovel({
      from: r.work.id,
      to: r.workNovel.workId,
    }),
    authors: r.many.workAuthorRelation(),
    authorList: r.many.workAuthor({
      from: r.work.id.through(r.workAuthorRelation.workId),
      to: r.workAuthor.id.through(r.workAuthorRelation.authorId),
    }),
    categories: r.many.workCategoryRelation(),
    categoryList: r.many.workCategory({
      from: r.work.id.through(r.workCategoryRelation.workId),
      to: r.workCategory.id.through(r.workCategoryRelation.categoryId),
    }),
    tags: r.many.workTagRelation(),
    tagList: r.many.workTag({
      from: r.work.id.through(r.workTagRelation.workId),
      to: r.workTag.id.through(r.workTagRelation.tagId),
    }),
    chapters: r.many.workChapter(),
    userReadingStates: r.many.userWorkReadingState(),
    requiredViewLevel: r.one.userLevelRule({
      from: r.work.requiredViewLevelId,
      to: r.userLevelRule.id,
      alias: 'WorkViewLevel',
    }),
  },
  workAuthor: {
    workAuthors: r.many.workAuthorRelation(),
    works: r.many.work({
      from: r.workAuthor.id.through(r.workAuthorRelation.authorId),
      to: r.work.id.through(r.workAuthorRelation.workId),
    }),
  },
  workAuthorRelation: {
    work: r.one.work({ from: r.workAuthorRelation.workId, to: r.work.id }),
    author: r.one.workAuthor({
      from: r.workAuthorRelation.authorId,
      to: r.workAuthor.id,
    }),
  },
  workCategory: {
    workCategories: r.many.workCategoryRelation(),
    works: r.many.work({
      from: r.workCategory.id.through(r.workCategoryRelation.categoryId),
      to: r.work.id.through(r.workCategoryRelation.workId),
    }),
  },
  workCategoryRelation: {
    work: r.one.work({ from: r.workCategoryRelation.workId, to: r.work.id }),
    category: r.one.workCategory({
      from: r.workCategoryRelation.categoryId,
      to: r.workCategory.id,
    }),
  },
  workChapter: {
    work: r.one.work({ from: r.workChapter.workId, to: r.work.id }),
    requiredViewLevel: r.one.userLevelRule({
      from: r.workChapter.requiredViewLevelId,
      to: r.userLevelRule.id,
      alias: 'ChapterReadLevel',
    }),
    readingStates: r.many.userWorkReadingState({
      alias: 'UserWorkReadingStateLastReadChapter',
    }),
  },
  workComic: {
    work: r.one.work({ from: r.workComic.workId, to: r.work.id }),
  },
  workNovel: {
    work: r.one.work({ from: r.workNovel.workId, to: r.work.id }),
  },
  workTag: {
    workTags: r.many.workTagRelation(),
    works: r.many.work({
      from: r.workTag.id.through(r.workTagRelation.tagId),
      to: r.work.id.through(r.workTagRelation.workId),
    }),
  },
  workTagRelation: {
    work: r.one.work({ from: r.workTagRelation.workId, to: r.work.id }),
    tag: r.one.workTag({ from: r.workTagRelation.tagId, to: r.workTag.id }),
  },
}))
