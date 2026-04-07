import { defineRelationsPart } from 'drizzle-orm'
import * as schema from '../schema/index'

export const forumRelations = defineRelationsPart(schema, (r) => ({
  forumModerator: {
    user: r.one.appUser({ from: r.forumModerator.userId, to: r.appUser.id }),
    group: r.one.forumSectionGroup({
      from: r.forumModerator.groupId,
      to: r.forumSectionGroup.id,
    }),
    actionLogs: r.many.forumModeratorActionLog(),
    moderatorSections: r.many.forumModeratorSectionRelation(),
    moderatedSections: r.many.forumSection({
      from: r.forumModerator.id.through(r.forumModeratorSectionRelation.moderatorId),
      to: r.forumSection.id.through(r.forumModeratorSectionRelation.sectionId),
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
  forumModeratorSectionRelation: {
    moderator: r.one.forumModerator({
      from: r.forumModeratorSectionRelation.moderatorId,
      to: r.forumModerator.id,
    }),
    section: r.one.forumSection({
      from: r.forumModeratorSectionRelation.sectionId,
      to: r.forumSection.id,
    }),
  },
  forumSection: {
    group: r.one.forumSectionGroup({
      from: r.forumSection.groupId,
      to: r.forumSectionGroup.id,
    }),
    appUserLevelRule: r.one.appUserLevelRule({
      from: r.forumSection.userLevelRuleId,
      to: r.appUserLevelRule.id,
    }),
    lastTopic: r.one.forumTopic({
      from: r.forumSection.lastTopicId,
      to: r.forumTopic.id,
      alias: 'LastTopic',
    }),
    topics: r.many.forumTopic(),
    moderatorSections: r.many.forumModeratorSectionRelation(),
    moderators: r.many.forumModerator({
      from: r.forumSection.id.through(r.forumModeratorSectionRelation.sectionId),
      to: r.forumModerator.id.through(r.forumModeratorSectionRelation.moderatorId),
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
  forumTag: {
    topicTags: r.many.forumTopicTagRelation(),
    topics: r.many.forumTopic({
      from: r.forumTag.id.through(r.forumTopicTagRelation.tagId),
      to: r.forumTopic.id.through(r.forumTopicTagRelation.topicId),
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
    topicTags: r.many.forumTopicTagRelation(),
    tags: r.many.forumTag({
      from: r.forumTopic.id.through(r.forumTopicTagRelation.topicId),
      to: r.forumTag.id.through(r.forumTopicTagRelation.tagId),
    }),
  },
  forumTopicTagRelation: {
    tag: r.one.forumTag({ from: r.forumTopicTagRelation.tagId, to: r.forumTag.id }),
    topic: r.one.forumTopic({
      from: r.forumTopicTagRelation.topicId,
      to: r.forumTopic.id,
    }),
  },
  forumUserActionLog: {
    user: r.one.appUser({
      from: r.forumUserActionLog.userId,
      to: r.appUser.id,
    }),
  },
}))
