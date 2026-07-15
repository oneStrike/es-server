import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const interactionRelations = defineRelationsPart(schema, (r) => ({
  emojiAsset: {
    pack: r.one.emojiPack({
      from: r.emojiAsset.packId,
      to: r.emojiPack.id,
    }),
    createdBy: r.one.adminUser({
      from: r.emojiAsset.createdById,
      to: r.adminUser.id,
      alias: 'EmojiAssetCreatedBy',
    }),
    updatedBy: r.one.adminUser({
      from: r.emojiAsset.updatedById,
      to: r.adminUser.id,
      alias: 'EmojiAssetUpdatedBy',
    }),
    recentUsageRecords: r.many.emojiRecentUsage(),
  },
  emojiPack: {
    assets: r.many.emojiAsset(),
    createdBy: r.one.adminUser({
      from: r.emojiPack.createdById,
      to: r.adminUser.id,
      alias: 'EmojiPackCreatedBy',
    }),
    updatedBy: r.one.adminUser({
      from: r.emojiPack.updatedById,
      to: r.adminUser.id,
      alias: 'EmojiPackUpdatedBy',
    }),
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
  userFavorite: {
    user: r.one.appUser({ from: r.userFavorite.userId, to: r.appUser.id }),
  },
  userFollow: {
    user: r.one.appUser({ from: r.userFollow.userId, to: r.appUser.id }),
  },
  userMention: {
    mentionedUser: r.one.appUser({
      from: r.userMention.mentionedUserId,
      to: r.appUser.id,
    }),
  },
  userLike: {
    user: r.one.appUser({ from: r.userLike.userId, to: r.appUser.id }),
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
    dispositionAttempts: r.many.userReportDispositionAttempt(),
  },
  userReportDispositionAttempt: {
    report: r.one.userReport({
      from: r.userReportDispositionAttempt.reportId,
      to: r.userReport.id,
    }),
    actor: r.one.appUser({
      from: r.userReportDispositionAttempt.actorUserId,
      to: r.appUser.id,
    }),
  },
}))
