import type { AppUserSelect } from '@db/schema'
import type { StructuredValue } from '@libs/platform/utils/jsonParse'
import type {
  NotificationAnnouncementSnapshotDto,
  NotificationChapterSnapshotDto,
  NotificationCommentActionDataDto,
  NotificationCommentContainerDto,
  NotificationCommentSnapshotDto,
  NotificationDataByTypeDto,
  NotificationTaskReminderDataDto,
  NotificationTaskReminderInfoDto,
  NotificationTaskRewardSnapshotDto,
  NotificationTaskSnapshotDto,
  NotificationTopicCommentedDataDto,
  NotificationTopicSnapshotDto,
  NotificationWorkSnapshotDto,
} from './dto/notification.dto'
import type { MessageNotificationCategoryKey } from './notification.constant'

export type MessageNotificationType = MessageNotificationCategoryKey

/** 稳定触发者快照：通知页只展示最小用户信息。 */
export type NotificationUserSnapshot = Pick<
  AppUserSelect,
  'id' | 'nickname' | 'avatarUrl'
>

/** 稳定评论快照。 */
export type NotificationCommentSnapshot = NotificationCommentSnapshotDto

/** 稳定主题快照。 */
export type NotificationTopicSnapshot = NotificationTopicSnapshotDto

/** 稳定作品快照。 */
export type NotificationWorkSnapshot = NotificationWorkSnapshotDto

/** 稳定章节快照。 */
export type NotificationChapterSnapshot = NotificationChapterSnapshotDto

/** 稳定公告快照。 */
export type NotificationAnnouncementSnapshot =
  NotificationAnnouncementSnapshotDto

/** 稳定任务快照。 */
export type NotificationTaskSnapshot = NotificationTaskSnapshotDto

/** 评论类通知复用的容器快照。 */
export type NotificationCommentContainerSnapshot =
  NotificationCommentContainerDto

/** 评论操作类通知数据。 */
export type NotificationCommentActionData = NotificationCommentActionDataDto

/** 主题评论通知数据。 */
export type NotificationTopicCommentedData = NotificationTopicCommentedDataDto

/** 任务奖励到账快照。 */
export type NotificationTaskRewardSnapshot = NotificationTaskRewardSnapshotDto

/** 任务提醒信息。 */
export type NotificationTaskReminderInfo = NotificationTaskReminderInfoDto

/** 任务提醒通知数据。 */
export type NotificationTaskReminderData = NotificationTaskReminderDataDto

/** 各通知分类对应的数据结构。 */
export type NotificationDataByTypeMap = NotificationDataByTypeDto

export type MessageNotificationData =
  NotificationDataByTypeMap[MessageNotificationType]

/** JSON 归一化后允许写入 payload 列的新通知数据。 */
export type MessageNotificationStoredData =
  | StructuredValue
  | MessageNotificationData
  | null
