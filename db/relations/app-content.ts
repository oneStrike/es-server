import * as schema from '@db/schema'
import { defineRelationsPart } from 'drizzle-orm'

export const appContentRelations = defineRelationsPart(schema, (r) => ({
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
    notificationFanoutTasks: r.many.appAnnouncementNotificationFanoutTask({
      from: r.appAnnouncement.id,
      to: r.appAnnouncementNotificationFanoutTask.announcementId,
      alias: 'AnnouncementFanoutHistory',
    }),
    currentNotificationFanoutTask: r.one.appAnnouncementNotificationFanoutTask({
      from: r.appAnnouncement.notificationFanoutTaskId,
      to: r.appAnnouncementNotificationFanoutTask.id,
      alias: 'AnnouncementCurrentFanout',
    }),
    views: r.many.appAnnouncementView(),
    userNotifications: r.many.userNotification({
      from: r.appAnnouncement.id,
      to: r.userNotification.announcementId,
    }),
  },
  appAnnouncementNotificationFanoutTask: {
    announcement: r.one.appAnnouncement({
      from: r.appAnnouncementNotificationFanoutTask.announcementId,
      to: r.appAnnouncement.id,
      alias: 'AnnouncementFanoutHistory',
    }),
    currentForAnnouncements: r.many.appAnnouncement({
      from: r.appAnnouncementNotificationFanoutTask.id,
      to: r.appAnnouncement.notificationFanoutTaskId,
      alias: 'AnnouncementCurrentFanout',
    }),
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
  appAnnouncementView: {
    announcement: r.one.appAnnouncement({
      from: r.appAnnouncementView.announcementId,
      to: r.appAnnouncement.id,
    }),
    user: r.one.appUser({
      from: r.appAnnouncementView.userId,
      to: r.appUser.id,
    }),
  },
}))
