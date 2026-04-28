import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema'

export const forumRelations = defineRelationsPart(schema, (r) => ({
  forumModerator: {
    user: r.one.appUser({ from: r.forumModerator.userId, to: r.appUser.id }),
    group: r.one.forumSectionGroup({
      from: r.forumModerator.groupId,
      to: r.forumSectionGroup.id,
    }),
    actionLogs: r.many.forumModeratorActionLog(),
    moderatorSections: r.many.forumModeratorSection(),
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
  forumHashtag: {
    references: r.many.forumHashtagReference(),
  },
  forumHashtagReference: {
    hashtag: r.one.forumHashtag({
      from: r.forumHashtagReference.hashtagId,
      to: r.forumHashtag.id,
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
    work: r.one.work({
      from: r.forumSection.id,
      to: r.work.forumSectionId,
    }),
  },
  forumSectionGroup: {
    sections: r.many.forumSection(),
    moderators: r.many.forumModerator(),
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
    lastCommentUser: r.one.appUser({
      from: r.forumTopic.lastCommentUserId,
      to: r.appUser.id,
      alias: 'UserLastCommentTopics',
    }),
    lastSections: r.many.forumSection({
      from: r.forumTopic.id,
      to: r.forumSection.lastTopicId,
      alias: 'LastTopic',
    }),
  },
  forumUserActionLog: {
    user: r.one.appUser({
      from: r.forumUserActionLog.userId,
      to: r.appUser.id,
    }),
  },
}))
